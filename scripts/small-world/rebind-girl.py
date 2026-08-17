"""rebind-girl.py — replace Meshy's auto-generated skin weights with clean,
scripted, reproducible ones.

    girl-v2.glb (raw Meshy export, UNTRACKED)
      -> THIS SCRIPT (headless Blender: recompute weights, emit a weight table)
      -> rebind-girl.mjs (transplant the table into the JOINTS_0/WEIGHTS_0
         accessors of the ORIGINAL file, everything else untouched)
      -> girl-v2-rebound.glb
      -> canonicalize-girl.mjs -> compress-girl.mjs -> girl.glb

WHY THIS SCRIPT DOES NOT WRITE A GLB

The brief asks this stage to change JOINTS/WEIGHTS and nothing else — mesh
topology, materials, texture and every animation curve must survive bit for bit.
A Blender glTF round-trip cannot deliver that: the importer rebuilds actions as
its own f-curves and the exporter re-samples and re-encodes them, re-writes the
atlas, and re-orders primitives. So Blender is used for the one thing only it can
do — the heat-diffusion solve — and hands back a weight TABLE keyed by the
export's own vertex indices. The transplant is a gltf-transform edit of two
accessors in the original document. Gate 2 (curves byte-identical) is then true
by construction rather than by hope, and it is asserted anyway.

Vertex correspondence is index-for-index: Blender's glTF importer preserves the
POSITION accessor's order (verified over all 107,876 vertices to 0.0007 mm, and
re-asserted by the .mjs stage on every run).

THE DEFECT BEING REPLACED (T115 audit, on the shipped build)
  - `neck` drives 54% of all skin vertices, reaching 11.0 cm past a 10.8 cm bone
  - the two forearm bones drive 240 of 49,265 triangles between them
  - shoulder weight mass is 1.86x asymmetric left-to-right
  - median dominant weight 0.588 — half the skin has no joint owning 60% of it

WHAT THIS SCRIPT DOES, AND THE TWO TRAPS THAT MAKE IT NECESSARY

  1. REBUILD THE BONE TAILS. glTF carries no bone length, so Blender's importer
     invents one: this rig arrives with an 11.6 m "Hips" whose tail points at
     (-853, -446, -575) cm. Bone heat seeds its diffusion from the head->tail
     SEGMENT, so left alone the solve is driven by lines shooting out of the
     body. Tails are rebuilt head -> primary child's head, the same segment
     construction T115's rigmodel.mjs measures against; leaf bones continue their
     parent's direction. This changes rest matrices, which would wreck the pose
     data — and cannot, because no pose data leaves this script.

  2. WELD BEFORE SOLVING. The export splits a position into a separate vertex at
     every UV-atlas island edge (2.06x: 107,876 index-space vertices over 52,295
     positions). The surface Blender sees is therefore a pile of coincident,
     unconnected shells and the heat Laplacian is singular — run directly, bone
     heat reports "failed to find solution for one or more bones" and returns 22
     empty groups in 0.7 s. Solved on a welded proxy it converges in ~2 s. The
     weights scatter back through the original->welded index map, so coincident
     vertices necessarily agree (which the previous export did not guarantee).

  Then, on the solved weights:
  3. REACH CLAMP    — an influence may not run past its own bone's anatomical
                      bound (this is the neck's 11 cm overhang, generalised).
  4. SYMMETRISE     — about the rig's own mirror plane, DERIVED from the bone
                      pairs, never assumed to be x=0.
  5. PRUNE / CAP / NORMALISE — drop influences under 0.05, keep the largest 4,
                      renormalise to sum 1.

`head_end` and `headfront` are held out of the solve. T115 recorded that they
carry zero weight and never articulate in any clip; giving them skin now would
be a new behaviour, not a fix, so they stay dead and the skin's 24-joint list is
unchanged.

DETERMINISM: no RNG, no wall-clock, no interactive ops. Dicts are iterated in
insertion order and every sort is total. Same GLB in -> identical table out.

Run (headless only — never through a GUI Blender):
  blender -b --python scripts/small-world/rebind-girl.py -- <src.glb> <out-stem>
writes <out-stem>.json (metadata + diagnostics) and <out-stem>.bin (the table).
"""

import bpy
import sys
import os
import json
import time
import struct
from mathutils import Vector, kdtree

# --- knobs, each one a decision rather than a default ------------------------

#: Position-key resolution for the weld, in the rig's centimetre units. 1e-4 cm
#: is a micron: far below any authored detail, far above float32 noise.
WELD_QUANT = 1e4

#: Which bone continues the chain where the skeleton forks. Copied from T115's
#: rigmodel.mjs so the segments this script clamps against are the same segments
#: the census measures. Note the skeleton runs Hips -> Spine02 -> Spine01 ->
#: Spine -> neck: the names ASCEND where the convention descends.
PRIMARY = {"Hips": "Spine02", "Spine": "neck", "Head": "head_end"}

#: Joints held out of the solve — see the header.
NON_DEFORM = ("head_end", "headfront")

#: A vertex is "core" to a bone when the bone owns this much of it. The reach
#: bound is derived from the core, so it is measured off this body rather than
#: guessed from an anatomy table.
CORE_W = 0.5
#: Reach radius = this percentile of core-vertex distances, times this margin.
#:
#: THE MARGIN IS THE WHOLE DESIGN AND THE FIRST VALUE WAS WRONG. A blend needs
#: secondary influences reaching WELL past the skin a bone owns outright — that
#: is what a smooth envelope is. Clamping to the core radius x1.25 removed
#: 185,941 influences, took the mean from 4.92 to 1.37 and drove the median
#: dominant weight to exactly 1.0000: a rigid bind, every vertex owned by one
#: bone, which is a worse asset than the jelly it replaced.
#:
#: THE CLAMP SHIPS DISABLED, AND THE REASON IS A MEASUREMENT, NOT A PREFERENCE.
#:
#: Rebuilt as a backstop — run after the prune, never allowed to touch a vertex's
#: dominant influence — k=1.5/pad=0.25 looked excellent on weight statistics: it
#: took the median dominant weight from 0.588 to 0.859 and brought `neck` from
#: 22.4% of the surface to 10.0%. Then the T115 deformation census was run on the
#: fully built asset, and it says the opposite (full table in task-117-report.md):
#:
#:     build      Jump_A  Jump_B  Jump_Off  Idle  Skip  Walk_B   worst p99
#:     Meshy        13.4    10.3      14.4   3.6  11.8     2.1       x4.21
#:     k1.5/p0.25   11.0    11.4      15.1   6.3  12.4     5.6       x7.02  <-- worse
#:     no clamp      9.3     7.0      11.2   2.8   9.0     2.3       x4.13  <-- best
#:
#: (peak % of skin area stretched past 1.5x, per clip). The clamp is a step
#: function on a continuous surface: two neighbouring vertices end up driven by
#: different bone SETS, and the triangle between them then carries the full
#: relative rotation of the joint. It doubled body-wide smear while every weight
#: statistic improved. Idle — the clip she spends most of her life in and the
#: cleanest in the file — went from 3.6% to 6.3%.
#:
#: So it is off, the machinery and the sweep stay for the record, and the reach
#: numbers are still REPORTED every run (reach_report) so a future export's
#: overreach is visible rather than silently clamped away.
REACH_CLAMP = False
REACH_PCT = 0.98
REACH_K = 1.5
#: Allowed overhang past either end of the bone, in bone lengths. T115 measured
#: `neck` running -0.50 .. +1.52 of its own bone; this would hold it to -0.25..1.25.
REACH_PAD = 0.25

#: Influence floor and cap. glTF's four-influence limit is a hard cap already;
#: 0.05 is the level below which an influence is dust that only smears.
PRUNE_BELOW = 0.05
MAX_INFLUENCES = 4

#: T118 — path to a per-original-vertex garment mask (see shirt-region.mjs).
#: When set, the garment's faces are held OUT of the body heat solve and its
#: weights come from a harmonic extension of the body's field instead. Empty
#: reproduces T117 exactly, so the two builds stay comparable.
SHIRT_MASK = ""

#: Laplacian passes applied to the garment's weights only (see garment_smooth).
#: Swept against the census, not chosen: see task-118-report.md.
SHIRT_SMOOTH = 0

#: "anchor" (the shipped treatment) or "smooth" (falsified; kept for the record).
GARMENT_MODE = "anchor"

#: Envelope contrast, applied as w -> w**GAMMA before each renormalisation.
#:
#: A heat solve is smoother than a limb is. On a cylindrical limb only the skin
#: inside the joint band should be shared; everything mid-segment should be owned
#: outright, so a healthy bind's median dominant weight sits near 0.9 and this
#: one's lands at 0.61. GAMMA is the one knob that addresses that directly: it
#: leaves 1.0 at 1.0 and 0.5/0.5 at 0.5/0.5, and pushes everything in between
#: toward its owner without moving where the joint bands are.
#:
#: IT SHIPS AT 1.0 — OFF — and that is the point of having swept it. The reach
#: clamp alone takes the median dominant weight from 0.588 to 0.859, past the
#: 0.75 gate, so the shipped weights are the heat solve's own field with a bound
#: on it and nothing else. Sharpening was available (1.5 reaches 0.972, 2.0
#: reaches 0.993) and is not used, because past about 1.5 the median is 1.0 and
#: that is a rigid bind wearing a good score.
GAMMA = 1.0

#: Laplacian smoothing of the weight field: passes, and how much of each vertex
#: is replaced by the mean of its neighbours. See smooth() for why it exists.
#:
#: Also OFF, and also because it was measured rather than assumed. It was added
#: to heal the step discontinuities the clamp and the prune leave behind, and on
#: the unclamped solve there is almost nothing left for it to heal: three passes
#: move the median dominant weight 0.6073 -> 0.6064 and the census slightly the
#: WRONG way (Jump_Off peak 11.2% -> 12.8%, knee.L peak 62 -> 84 triangles),
#: because the re-prune that has to follow it puts most of the smoothed tail
#: straight back on the floor. Kept, off, with its numbers.
SMOOTH_ITERS = 0
SMOOTH_LAMBDA = 0.5

#: Mirror match tolerance, as a fraction of standing height. 0.5% of 1.70 m is
#: 8.5 mm — tight enough that a hand cannot match a hip, loose enough to absorb
#: the asymmetry a hand-made mesh always carries.
MIRROR_TOL_FRAC = 0.005
#: A partial symmetrisation is worse than none: it would leave a seam between the
#: mirrored region and the rest. Below this match rate the pass declines to run
#: and says so, and the lane leans on bone heat's own (measured) symmetry.
MIRROR_MIN_MATCH = 0.60
#: The plane's NORMAL comes from the rig's bone pairs; its OFFSET is fitted to
#: the SKIN over this many candidate positions, because the rig and the mesh do
#: not agree — the midline bones all sit at x=1.1 cm while the paired bones'
#: midpoints average 0.5 cm, so no single derivation from the skeleton alone is
#: the answer for matching vertices.
MIRROR_OFFSET_STEPS = 81
MIRROR_OFFSET_SPAN = 4.0  # centimetres either side of the rig's estimate

SIDES = ("Left", "Right")


def log(*a):
    print("[rebind]", *a, flush=True)


def mirror_name(name):
    """The bone on the other side, or the bone itself if it is on the midline."""
    if name.startswith("Left"):
        return "Right" + name[4:]
    if name.startswith("Right"):
        return "Left" + name[5:]
    return name


def dist_to_segment(p, a, b):
    """Distance from p to segment ab, and the parameter t of the closest point."""
    ab = b - a
    L2 = ab.dot(ab)
    if L2 < 1e-12:
        return (p - a).length, 0.0
    t = (p - a).dot(ab) / L2
    tc = max(0.0, min(1.0, t))
    return (p - (a + ab * tc)).length, t


def load(glb):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb, guess_original_bind_pose=False)
    sc = bpy.context.scene
    meshes = [o for o in sc.objects if o.type == 'MESH' and o.visible_get()]
    # T113/T115: every export of this body carries a hidden 42-vertex Icosphere
    # in `glTF_not_exported`. It is not skinned and must not enter anything.
    assert len(meshes) == 1, "expected exactly one visible mesh, got %r" % [o.name for o in meshes]
    arms = [o for o in sc.objects if o.type == 'ARMATURE']
    assert len(arms) == 1, "expected exactly one armature, got %r" % [o.name for o in arms]
    return sc, meshes[0], arms[0]


def rebuild_tails(arm):
    """Trap 1 — give every bone a real segment. Returns {name: (head, tail)}."""
    heads = {b.name: Vector(b.head_local) for b in arm.data.bones}
    kids = {}
    for b in arm.data.bones:
        if b.parent:
            kids.setdefault(b.parent.name, []).append(b.name)
    parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}

    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    seg = {}
    for eb in arm.data.edit_bones:
        ks = kids.get(eb.name, [])
        if ks:
            pick = PRIMARY.get(eb.name, ks[0])
            tail = heads[pick if pick in heads else ks[0]]
        else:
            p = parent[eb.name]
            d = (heads[eb.name] - heads[p]) if p else Vector((0, 1, 0))
            u = d.normalized() if d.length > 1e-6 else Vector((0, 1, 0))
            tail = heads[eb.name] + u * max(d.length, 1.0)
        if (tail - heads[eb.name]).length < 1e-4:
            tail = heads[eb.name] + Vector((0, 1, 0))
        eb.tail = tail
        seg[eb.name] = (heads[eb.name].copy(), Vector(tail))
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in arm.data.bones:
        b.use_deform = b.name not in NON_DEFORM
    return seg


def weld(mesh):
    """Trap 2 — collapse the atlas-split duplicates. Returns (orig2weld, co, faces)."""
    key = {}
    orig2weld = [0] * len(mesh.vertices)
    co = []
    for i, v in enumerate(mesh.vertices):
        k = (round(v.co.x * WELD_QUANT), round(v.co.y * WELD_QUANT), round(v.co.z * WELD_QUANT))
        j = key.get(k)
        if j is None:
            j = len(co)
            key[k] = j
            co.append((v.co.x, v.co.y, v.co.z))
        orig2weld[i] = j
    faces = []
    for p in mesh.polygons:
        f = [orig2weld[i] for i in p.vertices]
        if len(set(f)) == len(f):
            faces.append(f)
    return orig2weld, co, faces


def weld_mask(orig2weld, n_weld, shirt_orig):
    """Lift a per-original-vertex garment mask into welded space.

    A welded vertex is garment only when EVERY original it swallowed is garment,
    which matches shirt-region.mjs's own rule and keeps the mask's boundary a
    ring of body vertices — the ring the solve keeps and the cloth stage pins to.
    """
    m = [1] * n_weld
    for i, j in enumerate(orig2weld):
        if not shirt_orig[i]:
            m[j] = 0
    return m


#: T118 — the two anchor groups the garment is split between. A chest panel is
#: torso cloth and a sleeve is arm cloth; nothing on this garment is both.
TORSO_ANCHORS = ("Hips", "Spine02", "Spine01", "Spine", "neck")
ARM_ANCHORS = ("LeftShoulder", "LeftArm", "LeftForeArm",
               "RightShoulder", "RightArm", "RightForeArm")
#: Width of the transition, in the rig's centimetres. The mix is a smooth
#: function of position across this band, so there is no dominance contest in it.
ANCHOR_BAND = 6.0


def garment_anchor_split(W, co, seg, shirt_weld):
    """Give every garment vertex ONE anchor family, mixed smoothly in space.

    T117 §6 named the defect by decomposition: two joints are near-tied across a
    wide band of the fused garment, so the dominance boundary between them is a
    sawtooth and the panel tears when the arm rises. The tie is the disease; a
    smoother weight field is not the cure, and the census proved it — garment-
    restricted Laplacian passes made every clip worse (12, 40 and 120 passes all
    measured, table in task-118-report.md), because surface smoothing mixes
    weights between parts of the garment that hang near DIFFERENT bones.

    This removes the tie instead of blending it. Each garment vertex is scored by
    how much nearer it lies to the arm chain than to the spine chain, that score
    is turned into a mix factor over a 6 cm band, and the vertex's own solved
    weights are then taken as `a` parts arm-family and `1-a` parts torso-family,
    each renormalised inside its family. A chest panel ends up with no arm
    influence to tie with; a sleeve ends up with no spine influence; and the
    transition between them is monotone in a single spatial field, so it cannot
    grow a sawtooth. The heat solve's own numbers are kept inside each family, so
    this reweights the garment without inventing an envelope for it.
    """
    def near(p, group):
        return min(dist_to_segment(p, *seg[b])[0] for b in group if b in seg)

    interior = [v for v in range(len(co)) if shirt_weld[v]]
    stats = {"garment_verts": len(interior), "torso_only": 0, "arm_only": 0, "mixed": 0,
             "band_cm": ANCHOR_BAND}
    for v in interior:
        p = Vector(co[v])
        d_arm = near(p, ARM_ANCHORS)
        d_torso = near(p, TORSO_ANCHORS)
        a = (d_torso - d_arm) / ANCHOR_BAND + 0.5
        a = 0.0 if a < 0.0 else (1.0 if a > 1.0 else a)
        w = W[v]
        arm = {b: x for b, x in w.items() if b in ARM_ANCHORS}
        torso = {b: x for b, x in w.items() if b not in ARM_ANCHORS}
        sa, st = sum(arm.values()), sum(torso.values())
        # A family with no solved support cannot contribute; hand its share to
        # the other rather than inventing weights the solve never found.
        if not sa:
            a = 0.0
        if not st:
            a = 1.0
        if a <= 0.0:
            stats["torso_only"] += 1
        elif a >= 1.0:
            stats["arm_only"] += 1
        else:
            stats["mixed"] += 1
        out = {}
        if a > 0.0 and sa:
            for b, x in arm.items():
                out[b] = out.get(b, 0.0) + a * x / sa
        if a < 1.0 and st:
            for b, x in torso.items():
                out[b] = out.get(b, 0.0) + (1.0 - a) * x / st
        W[v] = {b: x for b, x in out.items() if x > 1e-4} or w
    return stats


def garment_smooth(W, faces, shirt_weld, iterations, lam=1.0):
    """Iron the ragged dominance boundaries out of the garment, and only there.

    T118 first tried holding the garment OUT of the heat solve, which is what the
    brief asks for and what the defect description implies. It is wrong on this
    mesh, and the census said so: the sleeve IS the only surface over the upper
    arm and the panels ARE the only surface over the torso, so removing them
    leaves `LeftArm`/`RightArm` with almost nothing to diffuse against. Body-wide
    smear rose on five of six clips, `Idle` creasing went 12 -> 95 elbow frames,
    and arm smear reached 47%. Measured, then reverted.

    So the garment is held out of the RESULT instead. The solve runs on the whole
    surface exactly as T117 ran it — which means every BODY vertex keeps T117's
    weights bit for bit, and T117's torso wins are preserved by construction
    rather than by re-measurement — and then the garment's own weights are
    smoothed here, with the seam ring of body vertices pinned as fixed boundary
    data so the surface cannot crack along the seam.

    Smoothing is the right shape of tool for this defect. T117 proved (§3) that
    smear comes from STEPS in the weight field: where two joints are near-tied
    across a garment panel, the dominance boundary is a sawtooth and the panel
    tears when the arm rises. A Laplacian pass is the direct inverse of that, and
    T117 also measured that applying it body-wide is mildly harmful — there is
    nothing left to heal on a body that a heat solve already blended. Restricting
    it to the panels puts it exactly where the raggedness is.
    """
    adj = {}
    for f in faces:
        for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
            if shirt_weld[a]:
                adj.setdefault(a, set()).add(b)
            if shirt_weld[b]:
                adj.setdefault(b, set()).add(a)
    interior = sorted(v for v in adj if shirt_weld[v])
    for _ in range(iterations):
        nxt = {}
        for v in interior:
            nb = adj[v]
            acc = dict(W[v])
            for u in nb:
                for b, w in W[u].items():
                    acc[b] = acc.get(b, 0.0) + lam * w
            tot = sum(acc.values())
            nxt[v] = {b: w / tot for b, w in acc.items() if w / tot > 1e-4} if tot else W[v]
        for v, w in nxt.items():
            W[v] = w
    return {"garment_verts": len(interior), "iterations": iterations, "lambda": lam}


def bone_heat(sc, arm, co, faces, matrix_world):
    """Solve automatic (heat) weights on the welded proxy. Returns (names, W)."""
    me = bpy.data.meshes.new("t117_weldproxy")
    me.from_pydata(co, [], faces)
    me.update()
    obj = bpy.data.objects.new("t117_weldproxy", me)
    sc.collection.objects.link(obj)
    obj.matrix_world = matrix_world.copy()

    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    t0 = time.time()
    res = bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    log("bone heat", res, "in %.1fs" % (time.time() - t0))

    names = [g.name for g in obj.vertex_groups]
    W = [dict() for _ in range(len(co))]
    for v in me.vertices:
        for ge in v.groups:
            if ge.weight > 0.0:
                W[v.index][names[ge.group]] = ge.weight
    empty = sum(1 for w in W if not w)
    assert empty == 0, (
        "bone heat left %d of %d welded vertices with no influence — the solve "
        "did not converge; do not ship this table" % (empty, len(W))
    )
    return names, W


def reach_report(W, co, seg, names):
    """How far each bone's surviving influence actually runs — measured before
    anything is cut, so the clamp is answering a number rather than a hunch.

    `axial` is the T115 statistic: the influence's extent along the bone in bone
    lengths, where the audit found `neck` running -0.50 .. +1.52 of its own."""
    pts = [Vector(c) for c in co]
    out = {}
    for b in names:
        a, t = seg[b]
        L = (t - a).length
        ds, ps = [], []
        for i, w in enumerate(W):
            if w.get(b, 0.0) > 0.0:
                d, p = dist_to_segment(pts[i], a, t)
                ds.append(d)
                ps.append(p)
        if not ds:
            out[b] = None
            continue
        ds.sort()
        ps.sort()
        out[b] = {"n": len(ds), "bone_cm": round(L, 2),
                  "r_p98_cm": round(ds[min(len(ds) - 1, int(len(ds) * 0.98))], 2),
                  "r_max_cm": round(ds[-1], 2),
                  "axial_lo": round(ps[0], 2), "axial_hi": round(ps[-1], 2)}
    return out


def reach_clamp(W, co, seg, names):
    """Backstop against gross overreach — see REACH_K. Runs after the prune, so
    every influence it can remove is one that was carrying real weight."""
    pts = [Vector(c) for c in co]
    radius = {}
    for b in names:
        a, t = seg[b]
        ds = [dist_to_segment(pts[i], a, t)[0]
              for i, w in enumerate(W) if w.get(b, 0.0) >= CORE_W]
        if not ds:
            radius[b] = None
            continue
        ds.sort()
        radius[b] = ds[min(len(ds) - 1, int(len(ds) * REACH_PCT))] * REACH_K

    removed = {b: 0 for b in names}
    for i, w in enumerate(W):
        if not w:
            continue
        top = max(w.items(), key=lambda kv: (kv[1], kv[0]))[0]
        for b in list(w.keys()):
            # Never orphan a vertex: its owner survives whatever the bound says,
            # so the clamp can trim an envelope but can never punch a hole in the
            # skin. A bone with no core at all (radius None) keeps only the
            # vertices it dominates.
            if b == top:
                continue
            R = radius.get(b)
            if R is None:
                del w[b]
                removed[b] += 1
                continue
            a, t = seg[b]
            d, param = dist_to_segment(pts[i], a, t)
            if d > R or param < -REACH_PAD or param > 1.0 + REACH_PAD:
                del w[b]
                removed[b] += 1
    return {"radius_cm": {k: (round(v, 2) if v else None) for k, v in radius.items()},
            "removed": removed, "total_removed": sum(removed.values())}


def mirror_plane(seg, names):
    """The mirror plane's NORMAL, from the rig's own bone pairs. Never assumed to
    be x: it is the mean of the normalised left-minus-right head offsets, and the
    residual it leaves is reported rather than swept up."""
    pairs = [(b, mirror_name(b)) for b in names
             if b.startswith("Left") and mirror_name(b) in seg]
    assert pairs, "no Left/Right bone pairs — cannot derive a mirror plane"
    n = Vector((0, 0, 0))
    c = Vector((0, 0, 0))
    for l, r in pairs:
        d = seg[l][0] - seg[r][0]
        if d.length > 1e-6:
            n += d.normalized()
        c += (seg[l][0] + seg[r][0]) * 0.5
    n.normalize()
    c /= len(pairs)
    resid = max(((seg[l][0] - n * (2.0 * ((seg[l][0] - c).dot(n)))) - seg[r][0]).length
                for l, r in pairs)
    return n, c, resid, pairs


def mirror_match(pts, tree, n, c, tol):
    """Mutual nearest-neighbour correspondence across the plane (n, c)."""
    partner = [-1] * len(pts)
    for i, p in enumerate(pts):
        m = p - n * (2.0 * ((p - c).dot(n)))
        _, j, d = tree.find(m)
        if d <= tol:
            partner[i] = j
    # Mutual only: a one-way match means the two sides disagree about who mirrors
    # whom, and averaging across it would smear one side onto the other.
    return [j if (j >= 0 and partner[j] == i) else -1 for i, j in enumerate(partner)]


def symmetrise(W, co, seg, names, height):
    """Average each vertex's weights with its mirror's, bone names swapped.

    The plane's offset is FITTED TO THE SKIN, because the skeleton does not agree
    with itself: every midline bone head sits at x = 1.1 cm while the paired
    bones' midpoints average x = 0.5 cm, and the pair fit alone leaves a 1.30 cm
    residual — enough that a 8.5 mm match tolerance found partners for only 19%
    of the surface. So the normal comes from the rig and the offset is swept, and
    the sweep's own curve is reported so a bad fit is visible."""
    n, c, resid, pairs = mirror_plane(seg, names)
    tol = height * MIRROR_TOL_FRAC
    pts = [Vector(x) for x in co]
    tree = kdtree.KDTree(len(pts))
    for i, p in enumerate(pts):
        tree.insert(p, i)
    tree.balance()

    best = None
    sweep = []
    for k in range(MIRROR_OFFSET_STEPS):
        off = -MIRROR_OFFSET_SPAN + (2.0 * MIRROR_OFFSET_SPAN * k) / (MIRROR_OFFSET_STEPS - 1)
        cc = c + n * off
        partner = mirror_match(pts, tree, n, cc, tol)
        m = sum(1 for j in partner if j >= 0)
        sweep.append((round(off, 3), m))
        if best is None or m > best[1]:
            best = (off, m, cc, partner)
    off, matched, cc, partner = best
    rate = matched / len(pts)
    info = {"normal": [round(x, 6) for x in n], "rig_centre": [round(x, 4) for x in c],
            "rig_pair_residual_cm": round(resid, 4), "pairs": len(pairs),
            "tol_cm": round(tol, 4), "fitted_offset_cm": round(off, 3),
            "fitted_centre": [round(x, 4) for x in cc],
            "matched": matched, "of": len(pts),
            "matched_pct": round(100.0 * rate, 2),
            "sweep": sweep, "applied": rate >= MIRROR_MIN_MATCH,
            "min_match_pct": 100.0 * MIRROR_MIN_MATCH}
    if rate < MIRROR_MIN_MATCH:
        # Declining is the safe answer: symmetrising a fraction of the surface
        # would leave a seam where the mirrored region meets the rest, which is a
        # NEW defect traded for a smaller one. The asymmetry that remains is
        # measured in the final census instead.
        return W, info
    out = [dict(w) for w in W]
    for i, j in enumerate(partner):
        if j < 0:
            continue
        wi, wj = W[i], W[j]
        merged = {}
        for b in set(wi) | set(mirror_name(x) for x in wj):
            v = 0.5 * (wi.get(b, 0.0) + wj.get(mirror_name(b), 0.0))
            if v > 0.0:
                merged[b] = v
        out[i] = merged
    return out, info


def adjacency(n, faces):
    """Undirected vertex adjacency of the welded proxy, as sorted lists so the
    smoothing below is order-independent and therefore reproducible."""
    adj = [set() for _ in range(n)]
    for f in faces:
        for k in range(len(f)):
            a, b = f[k], f[(k + 1) % len(f)]
            adj[a].add(b)
            adj[b].add(a)
    return [sorted(s) for s in adj]


def smooth(W, adj, iterations, lam):
    """Laplacian smoothing of the weight FIELD across the surface.

    Every pass before this one can only cut: the prune drops an influence the
    moment it falls under 0.05 and the clamp drops it the moment a vertex steps
    outside a bound. Both are step functions on a continuous surface, so they
    leave neighbouring vertices with different influence SETS — and a triangle
    whose corners are driven by different bones is stretched by the full relative
    rotation between them the moment the joint bends. That is the mechanism
    behind the census result that sent this lane back: clamped hard, the rebind
    doubled body-wide smear even as its weight statistics improved.

    Smoothing puts the field back together. It is the standard remedy and it is
    the one operation here that can only ever make the envelope more continuous.
    """
    for _ in range(iterations):
        out = []
        for i, w in enumerate(W):
            acc = {}
            for b, v in w.items():
                acc[b] = acc.get(b, 0.0) + (1.0 - lam) * v
            nb = adj[i]
            if nb:
                s = lam / len(nb)
                for j in nb:
                    for b, v in W[j].items():
                        acc[b] = acc.get(b, 0.0) + s * v
            out.append(acc)
        W = out
    return W


def prune_cap_normalise(W, gamma=1.0):
    stats = {"pruned": 0, "capped": 0, "gamma": gamma}
    for w in W:
        items = sorted(w.items(), key=lambda kv: (-kv[1], kv[0]))
        if len(items) > MAX_INFLUENCES:
            stats["capped"] += len(items) - MAX_INFLUENCES
            items = items[:MAX_INFLUENCES]
        keep = [kv for kv in items if kv[1] >= PRUNE_BELOW]
        if not keep:
            keep = items[:1]
        stats["pruned"] += len(items) - len(keep)
        if gamma != 1.0:
            keep = [(b, v ** gamma) for b, v in keep]
        s = sum(v for _, v in keep) or 1.0
        w.clear()
        for b, v in keep:
            w[b] = v / s
    return stats


def census(W, names, label):
    """The T115 headline numbers, computed here so a bad table is visible before
    it ever reaches a GLB."""
    touched = {b: 0 for b in names}
    mass = {b: 0.0 for b in names}
    dom = {b: 0 for b in names}
    doms = []
    for w in W:
        if not w:
            continue
        top, tw = max(w.items(), key=lambda kv: (kv[1], kv[0]))
        dom[top] += 1
        doms.append(tw)
        for b, v in w.items():
            touched[b] += 1
            mass[b] += v
    doms.sort()
    tot = sum(mass.values()) or 1.0
    n = len(W)
    med = doms[len(doms) // 2] if doms else 0.0
    log("%s: median dominant weight %.4f  mean influences %.2f"
        % (label, med, sum(len(w) for w in W) / max(1, n)))
    return {"median_dominant": med, "p10_dominant": doms[int(len(doms) * 0.10)] if doms else 0,
            "min_dominant": doms[0] if doms else 0,
            "touched_pct": {b: round(100.0 * touched[b] / n, 2) for b in names},
            "mass_pct": {b: round(100.0 * mass[b] / tot, 3) for b in names},
            "dominant_verts": dom}


def main():
    global REACH_K, REACH_PAD, PRUNE_BELOW, GAMMA, SMOOTH_ITERS, SMOOTH_LAMBDA, REACH_CLAMP, SHIRT_MASK, SHIRT_SMOOTH, GARMENT_MODE
    argv = sys.argv[sys.argv.index("--") + 1:]
    src = os.path.abspath(argv[0])
    stem = os.path.abspath(argv[1])
    # Overrides exist so the knobs above could be SWEPT against the census
    # instead of asserted. The shipped values are the module constants; nothing
    # in the pipeline passes these.
    for i, a in enumerate(argv):
        if a == "--k":
            REACH_K = float(argv[i + 1])
        elif a == "--pad":
            REACH_PAD = float(argv[i + 1])
        elif a == "--prune":
            PRUNE_BELOW = float(argv[i + 1])
        elif a == "--gamma":
            GAMMA = float(argv[i + 1])
        elif a == "--smooth":
            SMOOTH_ITERS = int(argv[i + 1])
        elif a == "--lambda":
            SMOOTH_LAMBDA = float(argv[i + 1])
        elif a == "--clamp":
            REACH_CLAMP = argv[i + 1] not in ("0", "off", "false")
        elif a == "--shirt":
            SHIRT_MASK = os.path.abspath(argv[i + 1])
        elif a == "--shirt-smooth":
            SHIRT_SMOOTH = int(argv[i + 1])
        elif a == "--garment-mode":
            GARMENT_MODE = argv[i + 1]
    log("knobs: clamp %s (k %.2f pad %.2f) prune %.3f gamma %.2f smooth %dx%.2f"
        % (REACH_CLAMP, REACH_K, REACH_PAD, PRUNE_BELOW, GAMMA, SMOOTH_ITERS, SMOOTH_LAMBDA))

    sc, obj, arm = load(src)
    log("mesh", obj.name, len(obj.data.vertices), "verts;", "armature", arm.name,
        len(arm.data.bones), "bones")

    seg = rebuild_tails(arm)
    scale = obj.matrix_world.to_scale()[0]
    zs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    height = max(max(p.x for p in zs) - min(p.x for p in zs),
                 max(p.y for p in zs) - min(p.y for p in zs),
                 max(p.z for p in zs) - min(p.z for p in zs))
    log("standing height %.4f world units (bone unit = %.5f)" % (height, scale))

    orig2weld, co, faces = weld(obj.data)
    log("weld %d -> %d verts (%.2fx), %d faces kept of %d"
        % (len(orig2weld), len(co), len(orig2weld) / len(co), len(faces), len(obj.data.polygons)))

    diag = {}
    names, W = bone_heat(sc, arm, co, faces, obj.matrix_world)
    if SHIRT_MASK:
        with open(SHIRT_MASK, "rb") as f:
            shirt_orig = list(f.read())
        assert len(shirt_orig) == len(orig2weld), (
            "garment mask covers %d vertices, mesh has %d — the mask was built "
            "against a different source" % (len(shirt_orig), len(orig2weld)))
        shirt_weld = weld_mask(orig2weld, len(co), shirt_orig)
        diag["garment"] = {"welded_verts": sum(shirt_weld),
                           "mask": os.path.basename(SHIRT_MASK)}
        if GARMENT_MODE == "anchor":
            diag["garment"]["anchor"] = garment_anchor_split(W, co, seg, shirt_weld)
            log("garment: %d of %d welded verts, anchor split %s (body weights untouched)"
                % (sum(shirt_weld), len(co), diag["garment"]["anchor"]))
        elif SHIRT_SMOOTH:
            diag["garment"]["smooth"] = garment_smooth(W, faces, shirt_weld, SHIRT_SMOOTH)
            log("garment: %d of %d welded verts, %d smoothing passes (body weights untouched)"
                % (sum(shirt_weld), len(co), SHIRT_SMOOTH))
    diag["raw"] = census(W, names, "raw heat")

    # PRUNE FIRST. A heat solve leaves a long tail of dust — the raw table
    # averages 4.92 influences per vertex and `Head` touches 68% of the surface
    # at some nonzero level. Almost all of that is below 0.05 and vanishes here,
    # which is why the clamp that follows is a backstop and not the main event.
    diag["prune"] = prune_cap_normalise(W, GAMMA)
    diag["after_prune"] = census(W, names, "after prune")
    diag["reach_after_prune"] = reach_report(W, co, seg, names)
    nk = diag["reach_after_prune"].get("neck")
    if nk:
        log("neck reach after prune: %d verts, r_p98 %.2f cm, axial %.2f..%.2f of a %.2f cm bone"
            % (nk["n"], nk["r_p98_cm"], nk["axial_lo"], nk["axial_hi"], nk["bone_cm"]))

    if REACH_CLAMP:
        diag["clamp"] = reach_clamp(W, co, seg, names)
        log("reach clamp removed %d influences" % diag["clamp"]["total_removed"])
    else:
        diag["clamp"] = {"applied": False, "total_removed": 0}
        log("reach clamp DISABLED (measured harmful — see REACH_CLAMP)")

    if SMOOTH_ITERS:
        W = smooth(W, adjacency(len(co), faces), SMOOTH_ITERS, SMOOTH_LAMBDA)
        prune_cap_normalise(W, 1.0)
        diag["smooth"] = {"iters": SMOOTH_ITERS, "lambda": SMOOTH_LAMBDA}
        diag["after_smooth"] = census(W, names, "after smooth")

    # Height is in world units; the weld/segment maths is in bone units.
    W, sym = symmetrise(W, co, seg, names, height / scale)
    diag["symmetry"] = sym
    log("mirror: normal %s, offset %+.2f cm, rig-pair residual %.2f cm, matched %.1f%% -> %s"
        % (sym["normal"], sym["fitted_offset_cm"], sym["rig_pair_residual_cm"],
           sym["matched_pct"], "APPLIED" if sym["applied"] else "DECLINED"))

    diag["prune_final"] = prune_cap_normalise(W, GAMMA)
    diag["final"] = census(W, names, "final")
    diag["reach_final"] = reach_report(W, co, seg, names)

    # --- scatter welded -> original and write ------------------------------
    nv = len(orig2weld)
    idx = bytearray(nv * MAX_INFLUENCES)
    wts = bytearray(nv * MAX_INFLUENCES * 4)
    order = {b: i for i, b in enumerate(names)}
    for i in range(nv):
        w = W[orig2weld[i]]
        items = sorted(w.items(), key=lambda kv: (-kv[1], kv[0]))[:MAX_INFLUENCES]
        for k in range(MAX_INFLUENCES):
            if k < len(items):
                b, v = items[k]
                idx[i * MAX_INFLUENCES + k] = order[b]
                struct.pack_into("<f", wts, (i * MAX_INFLUENCES + k) * 4, v)
            else:
                idx[i * MAX_INFLUENCES + k] = idx[i * MAX_INFLUENCES]
                struct.pack_into("<f", wts, (i * MAX_INFLUENCES + k) * 4, 0.0)

    # Third block: the positions this solve was computed against, in glTF's own
    # frame and order. Every number above is addressed by vertex INDEX, which is
    # only meaningful if Blender's importer kept the POSITION accessor's order —
    # so the transplant re-derives that correspondence over every vertex from
    # this block instead of trusting a property of an importer version.
    #
    # Frame map, asserted by T115's bl_validate/validate pair and re-measured by
    # this lane over all 107,876 vertices (0.0007 mm): gltf = (bx, bz, -by), on
    # WORLD coordinates — the mesh hangs under an armature scaled 0.01, so object
    # space is centimetres.
    mw = obj.matrix_world
    pos = bytearray(nv * 3 * 4)
    for i, v in enumerate(obj.data.vertices):
        p = mw @ v.co
        struct.pack_into("<3f", pos, i * 12, p.x, p.z, -p.y)

    os.makedirs(os.path.dirname(stem), exist_ok=True)
    with open(stem + ".bin", "wb") as f:
        f.write(idx)
        f.write(wts)
        f.write(pos)
    meta = {
        "format": "t117-weights/1",
        "source": os.path.basename(src),
        "verts": nv,
        "influences": MAX_INFLUENCES,
        "bones": names,
        "welded": len(co),
        "knobs": {"weld_quant": WELD_QUANT, "core_w": CORE_W, "reach_pct": REACH_PCT,
                  "reach_k": REACH_K, "reach_pad": REACH_PAD,
                  "prune_below": PRUNE_BELOW, "mirror_tol_frac": MIRROR_TOL_FRAC,
                  "non_deform": list(NON_DEFORM),
                  "shirt_mask": os.path.basename(SHIRT_MASK) if SHIRT_MASK else None,
                  "shirt_smooth": SHIRT_SMOOTH, "garment_mode": GARMENT_MODE},
        "diagnostics": diag,
    }
    with open(stem + ".json", "w") as f:
        json.dump(meta, f, indent=1)
    log("wrote", stem + ".bin", "and", stem + ".json")


main()
