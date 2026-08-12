"""cloth-sim.py — one clip of Blender cloth simulation on the detached shirt.

Run HEADLESS, as a subprocess, never in the GUI (a bake blocks Blender's UI for
minutes; the campaign's standing rule):

    blender -b --python scripts/small-world/cloth-sim.py -- \
        --src scratchpad/t121/out/canon.glb \
        --map scratchpad/t121/out/clothmap.bin \
        --clip Skip_Forward --fps 30 --frames 87 \
        --out scratchpad/t121/out/sim-Skip_Forward.bin

WHAT IT WRITES, and why it writes both halves. For every frame it records the
garment's vertices TWICE: once from a duplicate carrying only the Armature
modifier (`base`) and once from the cloth object (`sim`). The bake never uses
either on its own — it uses the DIFFERENCE. Blender's armature evaluation and the
exact linear-blend skinning the browser does are not the same arithmetic, and a
target built from Blender's absolute positions would bake that disagreement into
the bone curves as if it were cloth. base and sim come from the same evaluation,
so subtracting them leaves only what the cloth solver did.

Frames are indexed 0..frames-1 at 1/fps seconds, which is how the glTF samplers
are spaced; the caller passes both and the JS side asserts that Blender's `base`
agrees with its own skinning before trusting anything.

Blender is Z-up and the glTF import rotates +90° about X, so a glTF point
(x, y, z) arrives at (x, -z, y). Positions are written back in glTF space and the
caller re-checks that against the bind pose.
"""
import bpy
import bmesh  # noqa: F401  (imported for side effects on some builds)
import sys
import json
import struct
import os
from mathutils import Vector

# ---------------------------------------------------------------------------
# The look. "Soft clay cloth, subtle and physical" — a shirt that settles and
# swings a little at the hem, not a flag. Every one of these is a fixed constant
# rather than a scene default so two runs of this file agree bit for bit.
# ---------------------------------------------------------------------------
QUALITY_STEPS = 6           # solver substeps per frame; stability, not look
MASS = 0.5                  # kg per vertex-area unit; a shirt with some body to it
TENSION = 20.0              # resist stretch — a shirt is not rubber
COMPRESSION = 20.0
SHEAR = 20.0
BENDING = 15.0              # the look knob: drapes, but does not ripple into wrinkles the
                            # cloth bones cannot carry (a rigid bone cannot express a crease)
TENSION_DAMPING = 20.0
COMPRESSION_DAMPING = 20.0
SHEAR_DAMPING = 20.0
BENDING_DAMPING = 1.0
AIR_DAMPING = 5.0           # kills flutter; this is what keeps it out of flag territory
PIN_STIFFNESS = 50.0        # Blender's default 1.0 is SOFT: the yoke sagged and took the
                            # whole shirt down with it (p99 113 mm -> 77 mm at 50; saturates there)
COLLISION_QUALITY = 3
# 6 mm. The collider under the shirt IS the lining (the body primitive's hole is
# filled by it), so this is how close the shirt may come to the body. Raising it
# to 11 mm — "hold the shirt at the position it was modelled in" — was tried and
# is WORSE on every count: it stands the shirt further off the body, so it lifts
# MORE, the leaked-lining count rose from 175 to 313 px/view on Idle, the
# deviation rose 24 -> 43 mm at p99 and the payload went over budget. That result
# is also what disproved "the shirt is sinking into the lining" as the cause of
# the leak (see the report: most of it is the hem lifting, which is the point).
COLLISION_DISTANCE = 0.006
SELF_COLLISION = False      # single layer; self-collision costs minutes and buys nothing
COLLIDER_RANGE = 0.05       # metres: body surface further than this from the shirt is deleted
COLLIDER_FACES = 9000       # decimate the collider to about this, so the solver is not walking a face count the shirt cannot use
GARMENT_MATERIAL = 'girl_garment'
PIN_GROUP = 'cloth_pin'


def argv():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {}
    i = 0
    while i < len(a):
        if a[i].startswith('--'):
            out[a[i][2:]] = a[i + 1] if i + 1 < len(a) and not a[i + 1].startswith('--') else True
            i += 2
        else:
            i += 1
    return out


# glTF is Y-up, Blender is Z-up, and the importer's conversion is the only piece
# of frame arithmetic this file does: everything else is read out of the object's
# own matrix_world. That matters — the importer ALSO puts this mesh in
# centimetres under a 0.01 object scale, so anything that assumed vertex
# coordinates were glTF metres was out by 100x (measured: a 7.3 m mismatch).
# Working in world space and letting matrix_world carry the scale makes the units
# and the root rotation somebody else's problem, and the map assertion below
# proves the whole chain rather than trusting it.
def gltf_to_blender(p):
    return Vector((p[0], -p[2], p[1]))


def blender_to_gltf(v):
    return (v.x, v.z, -v.y)


def main():
    args = argv()
    src = args['src']
    clip = args['clip']
    fps = int(args.get('fps', 30))
    frames = int(args['frames'])
    preroll = int(args.get('preroll', 0))
    out_path = args['out']
    # Look knobs are overridable so they can be SWEPT against a measured target
    # rather than guessed; the shipped values are the constants above.
    bending = float(args.get('bending', BENDING))
    air = float(args.get('air', AIR_DAMPING))
    mass = float(args.get('mass', MASS))
    # pin = 1 - alpha**pinpow. Raising it shrinks the part of the shirt that is
    # free to move WITHOUT changing the rig, which is what keeps the bone set and
    # the look tunable independently.
    pinpow = float(args.get('pinpow', 1.0))
    quality = int(args.get('quality', QUALITY_STEPS))
    collider_range = float(args.get('range', COLLIDER_RANGE))
    collider_faces = int(args.get('colliderfaces', COLLIDER_FACES))
    collision_distance = float(args.get('cdist', COLLISION_DISTANCE))
    pin_stiffness = float(args.get('pinstiff', PIN_STIFFNESS))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    # THE SCENE FPS MUST BE SET BEFORE THE IMPORT. The glTF importer converts
    # sampler times (seconds) into Blender keyframes using the scene's fps at
    # import time, and the factory default is 24. Setting it afterwards leaves
    # Skip_Forward's 2.8667 s spanning 68.8 frames instead of 86, so sampling
    # frame f while the caller means t = f/30 drifts 25% through the clip — which
    # showed up as Blender's armature-only garment disagreeing with the exact LBS
    # by 564 mm, and would otherwise have been baked in as "cloth".
    bpy.context.scene.render.fps = fps
    bpy.context.scene.render.fps_base = 1.0
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(src))

    scene = bpy.context.scene
    scene.render.fps = fps
    scene.render.fps_base = 1.0
    # Real-world scale: she is 1.7 m, so Blender's own gravity is the right one.
    scene.use_gravity = True
    scene.gravity = (0.0, 0.0, -9.81)

    # --- get the two primitives as two objects ------------------------------
    # Blender's glTF importer already gives one object per primitive here; a
    # build that merges them instead is handled by separating on material, so
    # this stage does not depend on which way the importer went.
    # Only meshes bound to the armature count. The caller runs Blender with
    # --factory-startup so no user addon is loaded, but this machine's BlenderMCP
    # addon also drops an Icosphere in on file load when it IS loaded, and that
    # object was silently classified as the collision body — a stray primitive
    # would be a much quieter failure than a crash.
    meshes = [o for o in scene.objects
              if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    if not meshes:
        raise SystemExit('cloth-sim: no armature-bound mesh in the import')
    if len(meshes) == 1:
        obj = meshes[0]
        if len(obj.data.materials) < 2:
            raise SystemExit('cloth-sim: the source has one material — it has not been detached')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='MATERIAL')
        bpy.ops.object.mode_set(mode='OBJECT')
    elif len(meshes) != 2:
        raise SystemExit(f'cloth-sim: expected one or two imported mesh objects, got {len(meshes)}')

    # Classify by the material the POLYGONS actually use, not by the slot list:
    # mesh.separate keeps every material slot on both halves, so a slot-name test
    # calls both pieces the garment.
    pieces = [o for o in scene.objects
              if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    garment = None
    body = None
    for o in pieces:
        used = {}
        for p in o.data.polygons:
            used[p.material_index] = used.get(p.material_index, 0) + 1
        dominant = max(used, key=used.get) if used else -1
        slots = o.data.materials
        name = slots[dominant].name if 0 <= dominant < len(slots) and slots[dominant] else ''
        if name.startswith(GARMENT_MATERIAL):
            garment = o
        else:
            body = o
    if garment is None or body is None:
        raise SystemExit(f'cloth-sim: could not tell the pieces apart: {[o.name for o in pieces]}')
    print(f'cloth-sim: garment={garment.name} ({len(garment.data.vertices)} v), body={body.name} ({len(body.data.vertices)} v)')

    # --- WELD, before anything is simulated --------------------------------
    # This is not an optimisation, it is a correctness precondition. The atlas is
    # a 10,812-chart mosaic and the glTF importer keeps every chart's copy of a
    # boundary vertex: the garment arrives as 17,534 vertices over 8,611 real
    # positions, which means the "cloth" is shattered into thousands of
    # disconnected islands along every UV seam. Simulated like that it does not
    # drape, it falls apart into confetti held on by its pins — and it would still
    # produce a plausible-looking file. Welding by distance restores the surface.
    import bmesh as _bm

    def weld(obj, dist=1e-4):
        bm = _bm.new()
        bm.from_mesh(obj.data)
        n0 = len(bm.verts)
        _bm.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        return n0, len(obj.data.vertices)

    gn0, gn1 = weld(garment)
    bn0, bn1 = weld(body)
    print(f'cloth-sim: welded garment {gn0} → {gn1}, body {bn0} → {bn1}')

    # One surface, or the drape is a lie. A handful of components is fine (the
    # mask absorbed small islands), thousands is the shattered case above.
    bmg = _bm.new()
    bmg.from_mesh(garment.data)
    bmg.verts.ensure_lookup_table()
    seen = set()
    comps = []
    for v in bmg.verts:
        if v.index in seen:
            continue
        stack = [v]
        seen.add(v.index)
        members = []
        while stack:
            c = stack.pop()
            members.append(c.index)
            for e in c.link_edges:
                o = e.other_vert(c)
                if o.index not in seen:
                    seen.add(o.index)
                    stack.append(o)
        comps.append(members)
    bmg.free()
    comps.sort(key=len, reverse=True)
    largest = set(comps[0])
    orphans = set().union(*[set(c) for c in comps[1:]]) if len(comps) > 1 else set()
    print(f'cloth-sim: garment components {len(comps)}, largest {len(comps[0])} of {gn1}, {len(orphans)} orphaned')
    if len(comps[0]) < gn1 * 0.5:
        raise SystemExit(f'cloth-sim: the garment is not one surface — largest component {len(comps[0])} of {gn1}')

    # --- map the shipped garment vertices onto Blender's -------------------
    with open(args['map'], 'rb') as fh:
        raw = fh.read()
    n_map = len(raw) // 16
    mp = struct.unpack(f'<{n_map * 4}f', raw)
    targets = [gltf_to_blender((mp[i * 4], mp[i * 4 + 1], mp[i * 4 + 2])) for i in range(n_map)]
    alphas = [mp[i * 4 + 3] for i in range(n_map)]

    from mathutils.kdtree import KDTree
    kd = KDTree(len(garment.data.vertices))
    mw = garment.matrix_world
    for i, v in enumerate(garment.data.vertices):
        kd.insert(mw @ v.co, i)
    kd.balance()

    # sidecar entry -> blender vertex, and the pin weight per blender vertex
    to_blender = []
    pin = {}
    worst = 0.0
    for i, t in enumerate(targets):
        co, bi, dist = kd.find(t)
        worst = max(worst, dist)
        to_blender.append(bi)
        pin[bi] = min(pin.get(bi, 1.0), 1.0 - alphas[i] ** pinpow)
    if worst > 1e-4:
        raise SystemExit(f'cloth-sim: vertex map does not land on the mesh (worst {worst * 1000:.3f} mm) '
                         '— the frame conversion or the source is wrong')

    # A vertex on a scrap island has nothing holding it: the mask's small
    # leftovers are not cloth, and left free they simply fall. One did, 8.9 m in
    # 1.3 s, and it landed in the bake as the worst "deviation" in the clip.
    # Everything outside the main surface is pinned to the body outright.
    for bi in orphans:
        pin[bi] = 1.0
    grp = garment.vertex_groups.new(name=PIN_GROUP)
    for bi, w in pin.items():
        grp.add([bi], float(w), 'REPLACE')
    free = sum(1 for w in pin.values() if w < 0.999)
    print(f'cloth-sim: pin group {len(pin)} vertices, {free} free to move')

    # --- shrink the collider to the surface the shirt can reach -------------
    # The body arrives as 104k triangles of whole character — feet, hands, hair,
    # face. A shirt cannot collide with any of it, but Blender's collision solver
    # still walks all of it every substep, and the first run was still going after
    # ten minutes on one clip. Deleting the faces that are out of reach is exact
    # rather than approximate: nothing the shirt could ever touch is removed. The
    # range is generous — the hem swings a few centimetres, not fifteen.
    t_faces = len(body.data.polygons)
    kd_g = KDTree(len(garment.data.vertices))
    for i, v in enumerate(garment.data.vertices):
        kd_g.insert(mw @ v.co, i)
    kd_g.balance()
    bmb = _bm.new()
    bmb.from_mesh(body.data)
    bmb.verts.ensure_lookup_table()
    bw = body.matrix_world
    near = [kd_g.find(bw @ v.co)[2] <= collider_range for v in bmb.verts]
    drop = [f for f in bmb.faces if not any(near[v.index] for v in f.verts)]
    _bm.ops.delete(bmb, geom=drop, context='FACES')
    loose = [v for v in bmb.verts if not v.link_faces]
    if loose:
        _bm.ops.delete(bmb, geom=loose, context='VERTS')
    bmb.to_mesh(body.data)
    bmb.free()
    body.data.update()
    # Even in reach, the collider is far finer than a collision needs: the shirt
    # is a smooth shell 6 mm off it, and every face costs the solver time on every
    # substep of every frame. Decimate FIRST in the stack so the armature still
    # drives the reduced surface.
    kept = len(body.data.polygons)
    if collider_faces and kept > collider_faces:
        dec = body.modifiers.new(name='ColliderDecimate', type='DECIMATE')
        dec.decimate_type = 'COLLAPSE'
        dec.ratio = collider_faces / kept
        dec.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = body
        try:
            bpy.ops.object.modifier_move_to_index(modifier='ColliderDecimate', index=0)
        except Exception as exc:
            print(f'cloth-sim: could not reorder the decimate modifier ({exc}) — leaving it after the armature')
    print(f'cloth-sim: collider {t_faces} → {kept} faces in reach '
          f'(within {collider_range * 100:.0f} cm), decimated toward {collider_faces or "nothing"}; '
          f'stack {[m.name for m in body.modifiers]}')

    # --- the un-simulated control ------------------------------------------
    base = garment.copy()
    base.data = garment.data.copy()
    scene.collection.objects.link(base)
    base.name = 'garment_base'

    # --- rig the sim --------------------------------------------------------
    coll = body.modifiers.new(name='Collision', type='COLLISION')
    body.collision.thickness_outer = collision_distance
    body.collision.thickness_inner = 0.02
    body.collision.damping_factor = 0.5
    body.collision.friction_factor = 0.5

    cloth = garment.modifiers.new(name='Cloth', type='CLOTH')
    s = cloth.settings
    s.quality = quality
    s.mass = mass
    s.tension_stiffness = TENSION
    s.compression_stiffness = COMPRESSION
    s.shear_stiffness = SHEAR
    s.bending_stiffness = bending
    s.tension_damping = TENSION_DAMPING
    s.compression_damping = COMPRESSION_DAMPING
    s.shear_damping = SHEAR_DAMPING
    s.bending_damping = BENDING_DAMPING
    s.air_damping = air
    s.use_pressure = False
    s.vertex_group_mass = PIN_GROUP
    s.pin_stiffness = pin_stiffness
    c = cloth.collision_settings
    c.collision_quality = COLLISION_QUALITY
    c.distance_min = collision_distance
    c.use_self_collision = SELF_COLLISION
    cloth.point_cache.frame_start = -preroll
    cloth.point_cache.frame_end = frames - 1

    # --- drive the clip -----------------------------------------------------
    arm = next((o for o in scene.objects if o.type == 'ARMATURE'), None)
    if arm is None:
        raise SystemExit('cloth-sim: no armature')
    action = next((a for a in bpy.data.actions if a.name == clip or a.name.endswith(clip)), None)
    if action is None:
        raise SystemExit(f'cloth-sim: no action named {clip}; have {[a.name for a in bpy.data.actions]}')
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    for slot in getattr(arm.animation_data, 'action_suitable_slots', []):
        arm.animation_data.action_slot = slot
        break

    # The caller may record only the first N frames (a look sweep does), so the
    # fps check is against the clip's TRUE length, not the recorded one.
    expect = float(args.get('span', frames - 1))
    span = action.frame_range[1] - action.frame_range[0]
    if abs(span - expect) > 1.5:
        raise SystemExit(f'cloth-sim: {clip} spans {span} Blender frames but the sampler rate implies {expect} '
                         '— the scene fps and the glTF sampler rate disagree')

    scene.frame_start = -preroll
    scene.frame_end = frames - 1

    # PRE-ROLL. A sim that starts at frame 0 starts with the shirt at rest and
    # spends the first half-second falling into place, which would be baked as
    # motion. Negative frames hold the clip's first pose (Blender clamps the
    # action) so the cloth settles onto a still figure before the clip begins.
    import time as _time
    t0 = _time.time()
    deps = bpy.context.evaluated_depsgraph_get()
    rec_base = []
    rec_sim = []
    for f in range(-preroll, frames):
        if (f + preroll) % 20 == 0:
            print(f'cloth-sim: frame {f} / {frames}  ({_time.time() - t0:.1f} s)', flush=True)
        scene.frame_set(f)
        deps = bpy.context.evaluated_depsgraph_get()
        if f < 0:
            continue
        ev_sim = garment.evaluated_get(deps)
        ev_base = base.evaluated_get(deps)
        m_sim = ev_sim.to_mesh()
        m_base = ev_base.to_mesh()
        vs = [blender_to_gltf(garment.matrix_world @ m_sim.vertices[bi].co) for bi in to_blender]
        vb = [blender_to_gltf(base.matrix_world @ m_base.vertices[bi].co) for bi in to_blender]
        rec_sim.append(vs)
        rec_base.append(vb)
        ev_sim.to_mesh_clear()
        ev_base.to_mesh_clear()

    with open(out_path, 'wb') as fh:
        for rec in (rec_base, rec_sim):
            for frame in rec:
                for p in frame:
                    fh.write(struct.pack('<3f', *p))
    with open(out_path + '.json', 'w') as fh:
        json.dump({
            'clip': clip, 'frames': frames, 'fps': fps, 'preroll': preroll, 'count': n_map,
            'blenderVertices': len(garment.data.vertices), 'mapWorstMm': worst * 1000,
            'settings': {
                'quality': quality, 'mass': mass, 'bending': bending, 'airDamping': air, 'pinPow': pinpow,
                'tension': TENSION, 'collisionDistance': collision_distance, 'selfCollision': SELF_COLLISION,
                'colliderRange': collider_range, 'colliderFaces': collider_faces, 'pinStiffness': pin_stiffness,
            },
        }, fh, indent=1)
    print(f'cloth-sim: {clip} {frames} frames, {n_map} sampled vertices, map worst {worst * 1000:.4f} mm')


main()
