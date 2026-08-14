"""THE ROTATION-INVARIANT TERRAIN OCCLUSION BAKE — the production pipeline behind
`public/labs/small-world/planet-occ-{a,b}.webp` (built in T128, promoted in T130).

    blender -b --factory-startup --python occ-bake.py -- \
        --geo <dir> --out <dir> --variant A|B [--res 2048] [--down 512] [--samples 512]

WHY THIS BAKE HAS NO ORIENTATION, AND WHY THAT IS THE WHOLE DESIGN
------------------------------------------------------------------
The shipped `planet-light.webp` is a Cycles bake of the T71 STUDIO rig — one key light, fixed in
world space — over ONE pose of the planet. It is sampled in planet-LOCAL uv while the planet spins
under that world-fixed key, so it is only correct at the single parked rotation it was baked at
(T127 §3 L2). It cannot be reused for the journey at any price.

This bake replaces the key with a UNIFORM WHITE WORLD and nothing else. Under a uniform dome every
unoccluded surface receives the same irradiance whichever way it faces, so the entire structure the
bake records is SELF-OCCLUSION: how much of the sky each point of the terrain can actually see, plus
the coloured light its own neighbours bounce back into it. Both are properties of the terrain in its
own frame. Rotate the planet and they rotate with it, exactly as the uv does.

Two consequences worth naming because they are what make this cheap:

  * There is NO Y-up/Z-up question here. A frame mapping only matters when something in the scene
    points somewhere; nothing in this scene does. The Blender world axes are unobservable in the
    output, which removes at a stroke the axis-conversion trap T90 paid for once with its PLY
    import (T90 §5b) — and is why the geometry arrives as raw float32 buffers, never through an
    importer that could silently rotate it.
  * The runtime keeps supplying the directional term. This atlas is a MULTIPLIER on the toon
    lighting, never a replacement for it, so the terminator that makes the planet read as a sphere
    (and that T127 measured the desk's ambient fill deleting) survives untouched.

WHAT IS BAKED, EXACTLY
----------------------
Cycles bake type DIFFUSE with Direct + Indirect ON and COLOR OFF. That is the "diffuse light" AOV:
the irradiance response with the surface's OWN albedo divided out by the renderer, so no division by
a possibly-dark vertex colour ever happens in post (which would amplify noise wherever the terrain
is dark). The bounce light still carries the albedo of the NEIGHBOURS it came off — a green meadow
valley bounces green into its own walls, canyon rust bounces rust — which is the "rich colour" half
of the look, and it is rotation-invariant for the same reason the occlusion is.

THIS SCRIPT DOES NOT SHAPE ANYTHING. It writes the raw occlusion field; the exponent and the floor
the look was fitted at are folded in by `occ-encode.mjs`, which reads them from
`scene/planet-occ-contract.ts` so the shipped image and the module that documents it cannot
disagree. Keeping the shaping out of here is what makes a re-shape a 3-second re-encode of the
float sheets rather than another 18 seconds of Cycles per variant — and what keeps this file
answerable only for physics.

Output: raw little-endian float32 RGB, `<res>` box-downsampled to `<down>`, plus a stats JSON. No
Blender image is ever saved, deliberately: a new Blender image defaults to sRGB and saving applies a
linear->sRGB encode to numbers that never had one (T90 paid for this too, 82.9% of the planet
clipped). Raw floats cannot be colour-managed by accident.
"""
import argparse
import json
import os
import sys
import time

import bpy
import numpy as np

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def parse():
    p = argparse.ArgumentParser()
    p.add_argument('--geo', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--variant', required=True, choices=['A', 'B'])
    p.add_argument('--res', type=int, default=2048)
    p.add_argument('--down', type=int, default=512)
    p.add_argument('--samples', type=int, default=512)
    p.add_argument('--bounces', type=int, default=3)
    p.add_argument('--seed', type=int, default=0)
    p.add_argument('--water', type=float, default=0.972,
                   help='waterline as a fraction of PLANET_RADIUS; 0 disables the mask')
    p.add_argument('--water-occluder', action='store_true',
                   help='also put a solid sphere at the waterline (measured worse — see report)')
    return p.parse_args(ARGS)


def f32(path):
    return np.fromfile(path, dtype='<f4')


def use_gpu(scene):
    """A background session reports no GPU until a backend is assigned explicitly (t81_pipeline)."""
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for want in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
        try:
            prefs.compute_device_type = want
        except TypeError:
            continue
        prefs.get_devices()
        devs = [d for d in prefs.devices if d.type == want]
        if devs:
            for d in prefs.devices:
                d.use = (d.type == want)
            scene.cycles.device = 'GPU'
            print(f'[occ-bake] cycles device {want}: {[d.name for d in devs]}', flush=True)
            return want
    scene.cycles.device = 'CPU'
    print('[occ-bake] cycles device CPU (no GPU backend available)', flush=True)
    return 'CPU'


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_mesh(geo, variant):
    """The shipped terrain, vertex for vertex. Non-indexed with contiguous face triplets, so loop i
    belongs to vertex i and the per-vertex uv/colour arrays transfer without a remap."""
    meta = json.load(open(os.path.join(geo, 'meta.json')))
    count = meta['count']
    pos = f32(os.path.join(geo, f'pos{variant}.f32')).reshape(count, 3)
    col = f32(os.path.join(geo, f'col{variant}.f32')).reshape(count, 3)
    uv = f32(os.path.join(geo, 'uv.f32')).reshape(count, 2)
    assert count % 3 == 0
    faces = np.arange(count, dtype=np.int32).reshape(-1, 3)

    mesh = bpy.data.meshes.new('terrain')
    mesh.from_pydata(pos.tolist(), [], faces.tolist())
    mesh.update()
    assert len(mesh.vertices) == count, (len(mesh.vertices), count)
    assert len(mesh.loops) == count

    # uv is authored per VERTEX and the mesh is non-indexed, so loop k -> vertex k. Read the loop's
    # own vertex_index rather than assuming the identity, so a reordering by from_pydata could not
    # slide the whole atlas sideways without the assert below catching it.
    vidx = np.empty(count, dtype=np.int32)
    mesh.loops.foreach_get('vertex_index', vidx)
    assert np.array_equal(vidx, np.arange(count, dtype=np.int32))

    uvl = mesh.uv_layers.new(name='atlas')
    uvl.uv.foreach_set('vector', uv.ravel())

    ca = mesh.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    rgba = np.ones((count, 4), dtype=np.float32)
    rgba[:, :3] = col
    ca.data.foreach_set('color', rgba.ravel())

    obj = bpy.data.objects.new('terrain', mesh)
    bpy.context.collection.objects.link(obj)
    return obj, count


def build_material(obj):
    """Matte lambertian over the shipped vertex colours. Roughness 1 / no specular so DIFFUSE is
    the whole surface response and the bake is not quietly missing a lobe."""
    mat = bpy.data.materials.new('terrain')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    bsdf.inputs['Roughness'].default_value = 1.0
    for name in ('Specular IOR Level', 'Specular'):
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = 0.0
    bsdf.inputs['Metallic'].default_value = 0.0
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    obj.data.materials.append(mat)
    return mat


def add_water_occluder(level, radius):
    """THE WATERLINE, as an occluder only — not a bake target.

    WHY IT IS HERE. Every sea, river channel, delta fan and canyon floor on this planet is terrain
    that dips BELOW `WATER_LEVEL`; the runtime hides them under a separate water sphere. Bake the
    terrain alone and Cycles sees those basins for what the geometry actually is — open pits, tens
    of texels deep — and shades their walls almost black. The visible consequence is not a dark sea
    (the water mesh covers that) but a HARD DARK LINE along every shoreline, where the last
    above-water texel inherits the pit's occlusion. It showed up immediately in the first capture
    round, on the delta's meadow and under the winter pond, and it reads as a smudge rather than as
    shading.

    A sphere at the waterline closes the pits. It is deliberately SMOOTH where the runtime's water
    is gently lumped, because the runtime's lumps are inward-only (`useWaterGeometry`: net radius is
    `WATER_LEVEL·(1 − inward + relief)` with relief clamped below the shoreline) — so a smooth
    sphere at exactly WATER_LEVEL is the upper envelope of the real surface. It can only occlude
    slightly MORE than the shipped water does, never less, which is the safe direction: the failure
    it is fixing is too little occlusion overhead, not too much.

    `visible_camera` stays on: this object is never uv-unwrapped and is not in the bake selection,
    so it contributes occlusion and bounce and receives nothing.
    """
    bpy.ops.mesh.primitive_uv_sphere_add(radius=level * radius, segments=192, ring_count=96)
    water = bpy.context.active_object
    water.name = 'waterline'
    mat = bpy.data.materials.new('waterline')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfDiffuse')
    # Mid-grey rather than the runtime's blue: the bounce this surface returns into the shoreline
    # should not tint the bank, and a blue cast on every beach is a look decision nobody made.
    bsdf.inputs['Color'].default_value = (0.5, 0.5, 0.5, 1.0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    water.data.materials.append(mat)
    water.select_set(False)
    return water


def build_world(strength=1.0):
    """THE UNIFORM SKY. One flat white background, no sun, no gradient, no HDRI — the single choice
    that makes the result rotation-invariant. A sky/ground gradient would be planet-locally
    directional (it would bake a permanent 'up') and would be exactly as pose-locked as the desk
    atlas, just in a different way."""
    world = bpy.data.worlds.new('uniform')
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    bg.inputs['Strength'].default_value = strength
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return world


def bake_waterline_mask(obj, mat, level, radius, res):
    """THE WATERLINE MASK — 1 above the shoreline, 0 below, in the atlas's own uv.

    WHY THIS EXISTS. Every sea, river channel, delta fan and canyon floor is terrain that dips below
    `WATER_LEVEL`; the runtime covers them with a separate water sphere. To the occlusion bake those
    basins are open pits tens of texels deep, and their walls shade almost black. No fragment of the
    visible planet ever samples inside one — the water mesh is in front — but the texels are
    NEIGHBOURS of the shoreline's, and bilinear filtering and every mip level average across the
    boundary. The result is a hard dark smear along shorelines and river channels, which the first
    capture round showed on the delta's meadow and under the winter pond, and which reads as dirt
    rather than as shading.

    Capping the pits with a solid sphere at the waterline was tried first and is WORSE: it turns the
    submerged walls from dark to black (fully enclosed), so the thing that bleeds gets stronger.
    The fix has to be to remove the submerged texels from the sheet altogether and let the shore's
    own value extend outward — which is what the flood pass below does, once it knows where the
    shore is.

    Rendered as an EMIT bake rather than computed in numpy so it is registered with the occlusion
    bake by construction: same mesh, same uv, same rasteriser, same margin. A hand-rasterised mask
    could be a texel out and would put the seam in the wrong place.
    """
    nt = mat.node_tree
    saved = nt.nodes['Principled BSDF'] if 'Principled BSDF' in nt.nodes else None
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    length = nt.nodes.new('ShaderNodeVectorMath')
    length.operation = 'LENGTH'
    gt = nt.nodes.new('ShaderNodeMath')
    gt.operation = 'GREATER_THAN'
    gt.inputs[1].default_value = level * radius
    emit = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(geo.outputs['Position'], length.inputs[0])
    nt.links.new(length.outputs['Value'], gt.inputs[0])
    nt.links.new(gt.outputs['Value'], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])

    img = bpy.data.images.new('mask', res, res, alpha=False, float_buffer=True, is_data=True)
    img.colorspace_settings.name = 'Non-Color'
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = img
    nt.nodes.active = node
    bpy.context.scene.cycles.bake_type = 'EMIT'
    bpy.ops.object.bake(type='EMIT')

    px = np.empty(res * res * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    mask = px.reshape(res, res, 4)[:, :, 0].copy()
    # Restore the surface shader so the caller can bake the real pass.
    if saved is not None:
        nt.links.new(saved.outputs['BSDF'], out.inputs['Surface'])
    nt.nodes.active = None
    return mask


def add_bake_target(mat, res):
    img = bpy.data.images.new('occ', res, res, alpha=False, float_buffer=True, is_data=True)
    img.colorspace_settings.name = 'Non-Color'
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    node.select = True
    return img


def main():
    a = parse()
    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()
    clear_scene()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    device = use_gpu(scene)

    cy = scene.cycles
    cy.samples = a.samples
    cy.use_adaptive_sampling = False   # deterministic sample count, not a noise-threshold race
    cy.use_denoising = False           # the downsample is the denoiser; see the report
    cy.seed = a.seed
    cy.use_animated_seed = False
    cy.max_bounces = a.bounces
    cy.diffuse_bounces = a.bounces
    cy.glossy_bounces = 0
    cy.transmission_bounces = 0
    cy.volume_bounces = 0
    cy.transparent_max_bounces = 0

    obj, count = build_mesh(a.geo, a.variant)
    mat = build_material(obj)
    build_world()

    meta = json.load(open(os.path.join(a.geo, 'meta.json')))
    if a.water_occluder and a.water > 0:
        add_water_occluder(a.water, meta['planetRadius'])

    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    bake = scene.render.bake
    bake.use_selected_to_active = False
    bake.margin = 16
    bake.margin_type = 'ADJACENT_FACES'
    bake.use_clear = True

    water_mask = None
    if a.water > 0:
        saved_samples = cy.samples
        cy.samples = 1  # an EMIT bake of a step function needs exactly one sample per texel
        water_mask = bake_waterline_mask(obj, mat, a.water, meta['planetRadius'], a.res)
        cy.samples = saved_samples
        print(f'[occ-bake] waterline mask: {(water_mask < 0.5).mean() * 100:.2f}% of the sheet is '
              f'below the shoreline', flush=True)

    img = add_bake_target(mat, a.res)
    scene.cycles.bake_type = 'DIFFUSE'
    bake.use_pass_direct = True
    bake.use_pass_indirect = True
    bake.use_pass_color = False

    print(f'[occ-bake] baking variant {a.variant}: {count} verts, {a.res}^2, '
          f'{a.samples} spp, {a.bounces} bounces, {device}', flush=True)
    bpy.ops.object.bake(type='DIFFUSE')
    t_bake = time.time() - t0

    px = np.empty(a.res * a.res * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    rgb = px.reshape(a.res, a.res, 4)[:, :, :3].copy()

    # ── COVERAGE DILATION ─────────────────────────────────────────────────────────────────────
    # The equirect sheet does NOT cover the whole [0,1]² tile: the poles fan out into wedges that
    # leave the corners unrasterised, and the ±π seam faces are pushed past u = 1 on purpose (the
    # runtime's RepeatWrapping in u), which clips their tail. Blender's bake margin only extends a
    # few pixels from each island edge and does not close them.
    #
    # This matters because the atlas MULTIPLIES. An unrasterised texel is 0.0, and although no
    # fragment's own uv lands in one, bilinear filtering and the mip chain both reach across the
    # coverage boundary — so a black gap paints a dark fringe along the seam meridian and around
    # both poles. That is a defect the eye finds immediately on a rotating planet.
    #
    # Fixed by flooding the gaps outward from real data: each pass replaces a still-empty texel
    # with the mean of its filled 4-neighbours. Deterministic, order-independent within a pass
    # (every pass reads the previous pass's array), and it never touches a texel the bake covered.
    filled = rgb.sum(axis=2) > 0.0
    gaps0 = int((~filled).sum())
    # Submerged texels are DATA the runtime must never see, not gaps in the rasterisation — see
    # bake_waterline_mask. Demoting them to unfilled hands them to the same flood, so the shore's
    # own occlusion extends across the water instead of a pit's darkness bleeding onto the bank.
    submerged = 0
    if water_mask is not None:
        under = water_mask < 0.5
        submerged = int(under.sum())
        filled = filled & (~under)
    passes = 0
    while not filled.all() and passes < 256:
        acc = np.zeros_like(rgb)
        cnt = np.zeros(filled.shape, dtype=np.int32)
        for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
            nb = np.roll(filled, shift, axis=axis)
            nv = np.roll(rgb, shift, axis=axis)
            acc += np.where(nb[:, :, None], nv, 0.0)
            cnt += nb.astype(np.int32)
        grow = (~filled) & (cnt > 0)
        if not grow.any():
            break
        rgb = np.where(grow[:, :, None], acc / np.maximum(cnt, 1)[:, :, None], rgb)
        filled = filled | grow
        passes += 1
    # Anything the flood could not reach (an island of empty with no filled neighbour anywhere)
    # goes to fully-open rather than to black: 1.0 is the no-occlusion identity, so an unreachable
    # texel becomes a no-op instead of a hole.
    rgb = np.where(filled[:, :, None], rgb, 1.0)
    gaps1 = int((~filled).sum())

    # Box downsample res -> down. This is the noise filter: 16 baked texels per output texel at
    # 2048->512 divides the Monte-Carlo standard error by 4, which is why denoising is off (an
    # OIDN pass would also smear the occlusion contact edges that are the point of the bake).
    k = a.res // a.down
    assert a.res == k * a.down
    small = rgb.reshape(a.down, k, a.down, k, 3).mean(axis=(1, 3))

    # The uv covers the whole sheet (equirect, no empty space), so every texel is real data and a
    # plain percentile over the whole image is an honest statistic.
    flat = small.reshape(-1, 3)
    lum = flat @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    stats = {
        'variant': a.variant,
        'res': a.res, 'down': a.down, 'samples': a.samples, 'bounces': a.bounces,
        'device': device, 'seconds': round(t_bake, 1), 'verts': count,
        'gaps': {'unrasterised': gaps0, 'pct': round(100.0 * gaps0 / (a.res * a.res), 3),
                 'submerged': submerged,
                 'submergedPct': round(100.0 * submerged / (a.res * a.res), 3),
                 'floodPasses': passes, 'unreached': gaps1},
        'lum': {
            'min': float(lum.min()), 'p01': float(np.percentile(lum, 1)),
            'p05': float(np.percentile(lum, 5)), 'median': float(np.median(lum)),
            'mean': float(lum.mean()),
            'p95': float(np.percentile(lum, 95)), 'p99': float(np.percentile(lum, 99)),
            'p999': float(np.percentile(lum, 99.9)), 'max': float(lum.max()),
        },
        # How far the bake is from grey — decides whether the atlas must ship RGB or can ship as a
        # single channel. Chroma = max|channel - luminance| per texel.
        'chroma': {
            'mean': float(np.abs(flat - lum[:, None]).max(axis=1).mean()),
            'p99': float(np.percentile(np.abs(flat - lum[:, None]).max(axis=1), 99)),
            'max': float(np.abs(flat - lum[:, None]).max(axis=1).max()),
        },
    }
    small.astype('<f4').tofile(os.path.join(a.out, f'occ{a.variant}_{a.down}.f32'))
    rgb.astype('<f4').tofile(os.path.join(a.out, f'occ{a.variant}_{a.res}_full.f32'))
    with open(os.path.join(a.out, f'occ{a.variant}_stats.json'), 'w') as fh:
        json.dump(stats, fh, indent=2)
    print('[occ-bake] ' + json.dumps(stats), flush=True)
    print(f'[occ-bake] done in {time.time() - t0:.1f}s', flush=True)


main()
