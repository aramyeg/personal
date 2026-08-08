"""T92 — the notebook INTERIOR: the page that gets revealed when the cover opens, and the
pencil sketch on the verso that is the reason for opening it.

    blender -b <t71_desk_bake.blend> --python t92_book_build.py -- \
        out=<dir> [open_deg=108] [stage=build|all] [ink_w=0.016]

WHAT THIS FILE OWNS, AND WHAT IT DELIBERATELY DOES NOT
======================================================
The shipped desk carries `Book2` — a closed hardcover: bottom board, spine, and a TOP COVER SLAB,
one connected component. The runtime opens that slab in the vertex shader by rotating its verts
about the spine. THE COVER IS NOT THIS FILE'S BUSINESS: it ships untouched, cranberry
(`POL_BOOK_C`) on every face it already had. What does not exist — and what the cover opening
would otherwise reveal as a 2 mm slot of nothing — is the INTERIOR. That is what is built here:

    Book2_PageR    the revealed recto, a paper plane facing UP, stays put when the book opens
    Book2_Gutter   a narrow dark strip in the crease, so the standing cover and the flat page
                   do not read as one folded card
    Book2_Verso    the paper page glued to the cover's inner face; rises WITH the cover
    Book2_Ink      the sketch, flat ribbons on the verso

Joined for shipping into `BookStatic` (page + gutter, never moves) and `BookVerso` (verso + ink,
which the runtime rotates by the same matrix it gives the cover slab).

WHY THE SKETCH IS ON THE VERSO AND NOT ON THE PAGE
=================================================
T92 spike 3's finding, kept: `MoneyShotCam` sits 25 degrees above the desk (measured: forward
lab (0, -0.4288, -0.9034)). A drawing lying flat on the revealed recto is seen at that grazing
angle and loses ~0.6 of its height — rendered, it was a smudge. The verso rises with the cover to
18 degrees PAST vertical at the 108-degree open pose, so its face normal ends up at
0.951*n + 0.309*y: pointing at the camera. The drawing goes on the only surface that faces the
viewer.

WHY THE SPINE IS THE FAR EDGE (AND SO WHY "UP" ON THE VERSO IS "AWAY FROM THE SPINE")
====================================================================================
Derived, not assumed: the camera is at lab z = 17.04 and the book at lab z 8.78..9.66, so +z is
toward the viewer. The slab's spine edge is its LOW-z edge, i.e. the far one. Opening therefore
stands the cover up and leans it back, and the page it uncovers lies flat and faces the camera —
whereas a side hinge would swing the page sideways at the same grazing angle and gain nothing.

WHY THE DRAWING'S ORIENTATION IS MEASURED RATHER THAN REASONED
==============================================================
"Upright and unmirrored" is a fact about the camera, not about the mesh, and the spike got there
by trying a sign and looking. Here the two signs are SOLVED: the posed verso's in-plane basis
vectors are projected through `world_to_camera_view`, and the stroke frame is defined as
(+X -> screen right, +Y -> screen up) by construction. That cannot be mirrored and cannot be
upside down. The render still gates it — the measurement decides, the picture confirms.

WHY THE PANELS ARE GRIDS AND NOT QUADS
======================================
The lighting ships as VERTEX colour. A four-vertex page bakes four corner samples, and the one
thing the interior needs the bake to carry — the standing cover's shadow falling across the recto,
and the light falling off up the verso — lives entirely in the gradient BETWEEN those corners. So
each panel is subdivided at roughly a 0.05-unit cell. ~1.2k verts total is the price of the page
having a shadow on it at all.

THE 2 MM SLOT
=============
Everything sits between the page block's top (`Pages2`, lab y 1.6390) and the cover slab's
underside (lab y 1.6410), and the layer heights are derived DOWNWARD from the slab's own measured
underside so the stack cannot drift if the master ever moves:

    verso   slab_bottom - 0.0004      (paper, faces DOWN when closed)
    ink     slab_bottom - 0.0008      (on the verso's visible side)
    gutter  slab_bottom - 0.0011      (faces UP)
    recto   slab_bottom - 0.0012      (faces UP)

THE FLEX ZONE, AND WHY THE PANEL AND THE DRAWING NO LONGER SHARE A FLOOR
=======================================================================
The runtime's cover rotation is a rigid rotation of the slab about one line, but real paper near a
spine bends rather than hinges, so the drawing is kept at u >= 0.16 from the spine axis and the
integrator gets a band to flex in. Page and gutter, which never move, need only u >= 0.02.

The verso PANEL started at 0.16 too, and that was wrong — found in the browser by the build lane,
not here. `Book2`'s cover slab has an underside that was never surfaced and bakes BLACK, and at the
open pose that underside is the bottom of the standing panel, facing the camera. Stopping the paper
at 0.16 left a black band across the base of the page. So the panel now runs down to u >= 0.06 and
covers it, while the strokes stay exactly where they were: the paper's job is to hide the slab, the
drawing's job is to stay out of the fold. They are different constraints and now have different
numbers.
"""
import gzip
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
A = dict(a.split('=', 1) for a in argv if '=' in a)


def farg(k, d):
    return float(A.get(k, d))


OUT_DIR = os.path.abspath(A.get('out', os.path.join(os.path.dirname(bpy.data.filepath), 't92book')))
BLEND_DIR = os.path.abspath(A.get('blend_dir', os.path.join(OUT_DIR, '..', '..', 'blend')))
STAGE = A.get('stage', 'all')
OPEN_DEG = farg('open_deg', 108.0)
INK_W = farg('ink_w', 0.016)
CELL = farg('cell', 0.05)

BOOK = 'Book2'
INSET = 0.985            # 1.5% in from Book2's own footprint on every edge
U_FLEX = 0.16            # the DRAWING keeps clear of the spine by this much (runtime flex band)
U_PANEL = 0.06           # the verso PANEL runs closer, to cover the cover slab's unlit underside
U_PAGE = 0.02            # page/gutter may come this close
GUT_W = 0.05             # gutter strip width, measured out from u = U_PAGE
DY_VERSO, DY_INK, DY_GUT, DY_PAGE = 0.0004, 0.0008, 0.0011, 0.0012   # below the slab underside

NEW = ('Book2_PageR', 'Book2_Gutter', 'Book2_Verso', 'Book2_Ink', 'BookStatic', 'BookVerso')

sc = bpy.context.scene
vl = bpy.context.view_layer


# ----------------------------------------------------------------- frames
# The lab (glTF, y-up) frame is (bx, bz, -by) of the blend (z-up) frame.
def to_lab(v):
    return Vector((v.x, v.z, -v.y))


def to_blend(l):
    return Vector((l.x, -l.z, l.y))


def use_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for want in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = want
            prefs.get_devices()
            picked = [d for d in prefs.devices if d.type == want]
            if not picked:
                continue
            for d in prefs.devices:
                d.use = (d.type == want)
            sc.cycles.device = 'GPU'
            print('  cycles device: GPU/%s -> %s' % (want, [d.name for d in picked]), flush=True)
            return
        except Exception as e:                                    # noqa: BLE001
            print('  %s unavailable: %s' % (want, e))
    sc.cycles.device = 'CPU'
    print('  cycles device: CPU (no GPU backend)', flush=True)


def purge(name):
    ob = bpy.data.objects.get(name)
    if ob is None:
        return
    d = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    if isinstance(d, bpy.types.Mesh) and d.users == 0:
        bpy.data.meshes.remove(d)


# ================================================================= 1. the axis
def derive_axis():
    """Everything geometric in this file comes out of `Book2`'s own mesh.

    The slab is separated from the shell by the largest gap in the sorted vertex-y list that lies
    nearest the top (measured: verts cluster at 1.547/1.559/1.563 | 1.602 | 1.641/1.645/1.657, so
    the cut lands at 1.6215 and takes exactly the plate). The spine direction is the principal axis
    of the slab's footprint — the slab is 1.06 x 0.78, so its long axis IS the spine. The spine
    line itself is that axis pushed to the slab's minimum-u edge, u being distance from the spine
    toward the book's front (+lab z, i.e. toward the camera).
    """
    ob = bpy.data.objects[BOOK]
    L = [to_lab(ob.matrix_world @ v.co) for v in ob.data.vertices]
    ys = sorted({round(p.y, 4) for p in L})
    gaps = [(ys[i + 1] - ys[i], ys[i], ys[i + 1]) for i in range(len(ys) - 1)]
    big = max(g[0] for g in gaps)
    lo, hi = [(a, b) for g, a, b in gaps if g >= 0.5 * big][-1]     # the HIGHEST large gap
    thr = 0.5 * (lo + hi)
    slab = [p for p in L if p.y > thr]

    cx = sum(p.x for p in slab) / len(slab)
    cz = sum(p.z for p in slab) / len(slab)
    sxx = sum((p.x - cx) ** 2 for p in slab)
    szz = sum((p.z - cz) ** 2 for p in slab)
    sxz = sum((p.x - cx) * (p.z - cz) for p in slab)
    th = 0.5 * math.atan2(2.0 * sxz, sxx - szz)
    d = Vector((math.cos(th), 0.0, math.sin(th)))
    if d.x < 0:
        d = -d
    n = Vector((-d.z, 0.0, d.x))                                   # +n points toward the book front

    c = Vector((cx, 0.0, cz))
    us = [(p - c).dot(n) for p in slab]
    ts = [(p - c).dot(d) for p in slab]
    u_min, u_max = min(us), max(us)
    top = max(p.y for p in slab)
    bot = min(p.y for p in slab)

    # A = the spine line's point at t = 0. u is redefined to measure from THIS line, so u = 0 is
    # the spine and every clearance in this file is a plain distance.
    A_xz = c + n * u_min
    axis_top = Vector((A_xz.x, top, A_xz.z))                       # spine-side TOP edge
    axis_piv = Vector((A_xz.x, 0.5 * (top + bot), A_xz.z))         # recommended pivot: mid-thickness

    info = dict(d=d, n=n, A=A_xz, top=top, bot=bot, thr=thr,
                t_min=min(ts), t_max=max(ts), u_max=u_max - u_min,
                axis_top=axis_top, axis_piv=axis_piv, nslab=len(slab))
    print('T92_BOOK_AXIS  slab: %d/%d verts (cut at lab y %.4f), lab y %.4f..%.4f, footprint %.4f x %.4f'
          % (len(slab), len(L), thr, bot, top, info['t_max'] - info['t_min'], info['u_max']), flush=True)
    print('T92_BOOK_AXIS  dir  (lab, unit)   = (%.6f, %.6f, %.6f)   yaw %.3f deg'
          % (d.x, d.y, d.z, math.degrees(math.atan2(d.z, d.x))), flush=True)
    print('T92_BOOK_AXIS  normal (lab, unit) = (%.6f, %.6f, %.6f)   (u = toward book front)'
          % (n.x, n.y, n.z), flush=True)
    print('T92_BOOK_AXIS  top-edge point (lab) = (%.6f, %.6f, %.6f)'
          % (axis_top.x, axis_top.y, axis_top.z), flush=True)
    print('T92_BOOK_AXIS  PIVOT mid-thickness (lab) = (%.6f, %.6f, %.6f)   <- rotate the cover here'
          % (axis_piv.x, axis_piv.y, axis_piv.z), flush=True)
    return info


def open_matrix(ax, deg):
    """The blend-frame matrix that OPENS the cover: it lifts the far edge and carries it back over
    the spine. Which sign of rotation does that is decided by trying both on a probe point and
    keeping the one that goes UP, rather than by arguing about handedness."""
    axis_b = to_blend(ax['d']) - to_blend(Vector((0, 0, 0)))
    piv_b = to_blend(ax['axis_piv'])
    probe = to_blend(ax['axis_piv'] + ax['n'] * 0.5)
    best = None
    for sgn in (1.0, -1.0):
        M = (Matrix.Translation(piv_b) @ Matrix.Rotation(sgn * math.radians(deg), 4, axis_b)
             @ Matrix.Translation(-piv_b))
        got = to_lab(M @ probe)
        if best is None or got.y > best[1]:
            best = (M, got.y, sgn, got)
    M, _, sgn, got = best
    du = (got - ax['axis_piv']).dot(ax['n'])
    print('  open %.1f deg: rotation sign %+.0f about the spine; probe u 0.500 -> u %.3f, lab y %+.3f'
          % (deg, sgn, du, got.y - ax['axis_piv'].y), flush=True)
    return M


# ================================================================= 2. materials
# SOLVED BACKWARDS FROM THE DISPLAY, NOT CHOSEN AS AN ALBEDO.
#
# Spike 3 derived POL_PENCIL from POL_SOIL and set base colour (0.20, 0.19, 0.21) — "graphite, not
# ink". Measured through THIS rig and AgX, that lands the strokes at 199 sRGB against paper at 239:
# 83% of the page's luminance. That is not a drawing, it is a watermark, and it is why the sketch
# went soft at presentation size. The cause is the view transform, not the material — the studio is
# hot enough that the paper sits well past AgX's shoulder, so a 5x drop in scene radiance is
# compressed into 40 display levels.
#
# So the albedo is solved from the number wanted at the far end, the way t71_export solves the metal
# tints from the reference rather than from a swatch. Measured sweep (median sRGB inside a
# colour-ID mask, at the money-shot crop):
#
#     albedo   0.008   0.020   0.050   0.100   0.200
#     strokes    104     123     153     178     199      (paper 239, verso 235)
#
# 0.029 puts the strokes near 135 — about 56% of the page, which is where a 2B line on white
# actually photographs. Darker was available and refused for spike 3's stated reason: at 104 the
# line is black and the page reads as printed stationery rather than as something someone drew.
PENCIL_ALBEDO = 0.029


def pencil_material():
    """Graphite, not ink. See PENCIL_ALBEDO for why the number is not the spike's 0.20."""
    m = bpy.data.materials.get('POL_PENCIL')
    if m is None:
        m = bpy.data.materials['POL_SOIL'].copy()
        m.name = 'POL_PENCIL'
    b = m.node_tree.nodes.get('Principled BSDF')
    v = PENCIL_ALBEDO
    # the faint warm/cool split of the spike's grey is kept — graphite is not neutral
    b.inputs['Base Color'].default_value = (v, v * 0.95, v * 1.05, 1.0)
    b.inputs['Roughness'].default_value = 0.85
    return m


# ================================================================= 3. panels
def emit(name, quads, verts, mat, want_up):
    """Build a single-sided sheet and force its winding so the normal points the way asked."""
    bm = bmesh.new()
    bv = [bm.verts.new(v) for v in verts]
    bm.verts.index_update()
    for q in quads:
        try:
            bm.faces.new([bv[i] for i in q])
        except ValueError:
            pass
    bm.normal_update()
    ny = sum(to_lab(f.normal).y for f in bm.faces)
    if (ny > 0) != want_up:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    (bpy.data.collections.get('PROPS') or sc.collection).objects.link(ob)
    return ob


def panel(name, ax, t0, t1, u0, u1, y, mat, want_up):
    nt = max(2, int(round((t1 - t0) / CELL)) + 1)
    nu = max(2, int(round((u1 - u0) / CELL)) + 1)
    verts, quads = [], []
    for j in range(nu):
        u = u0 + (u1 - u0) * j / (nu - 1.0)
        for i in range(nt):
            t = t0 + (t1 - t0) * i / (nt - 1.0)
            p = ax['A'] + ax['d'] * t + ax['n'] * u
            verts.append(to_blend(Vector((p.x, y, p.z))))
    for j in range(nu - 1):
        for i in range(nt - 1):
            a = j * nt + i
            quads.append((a, a + 1, a + nt + 1, a + nt))
    ob = emit(name, quads, verts, mat, want_up)
    print('  %-13s t %+.3f..%+.3f  u %.3f..%.3f  lab y %.4f  %dx%d = %d verts'
          % (name, t0, t1, u0, u1, y, nt, nu, len(ob.data.vertices)), flush=True)
    return ob


# ================================================================= 4. the sketch
def strokes():
    """Spike 3's stroke data, unchanged: the bird figurine as it actually reads (a plump egg, a
    head lobe barely set off, a wedge beak, a flicked tail) and the penguin beside it. Authored in
    a plain right-handed drawing frame — +X right, +Y up — and mapped onto the verso by a frame
    that is measured from the camera, so this data never has to know about mirroring."""
    def circle(cx, cy, r, n=26, squash=1.0, a0=0.0, a1=2 * math.pi):
        return [(cx + r * math.cos(a0 + (a1 - a0) * k / (n - 1.0)),
                 cy + r * squash * math.sin(a0 + (a1 - a0) * k / (n - 1.0)))
                for k in range(n)]

    S = []
    bx, by = -0.46, -0.06
    S.append(circle(bx, by - 0.06, 0.34, squash=1.02))                                  # body
    S.append(circle(bx + 0.02, by + 0.30, 0.19, squash=0.98, a0=-0.35, a1=3.5))         # head
    S.append([(bx - 0.16, by + 0.33), (bx - 0.42, by + 0.24), (bx - 0.15, by + 0.19)])  # beak
    S.append([(bx + 0.30, by + 0.02), (bx + 0.62, by + 0.34), (bx + 0.44, by - 0.10)])  # tail
    S.append(circle(bx - 0.06, by + 0.34, 0.045, n=12))
    S.append(circle(bx + 0.13, by + 0.32, 0.045, n=12))

    px, py = 0.50, -0.04
    S.append(circle(px, py, 0.30, squash=1.30))                                         # body
    S.append(circle(px, py + 0.19, 0.215, squash=0.80, a0=0.10, a1=3.04))               # cap
    S.append(circle(px, py - 0.02, 0.175, squash=1.25, a0=-1.9, a1=1.9))                # belly
    S.append([(px - 0.29, py + 0.08), (px - 0.44, py - 0.18), (px - 0.25, py - 0.16)])
    S.append([(px + 0.29, py + 0.08), (px + 0.44, py - 0.18), (px + 0.25, py - 0.16)])
    S.append([(px - 0.15, py - 0.40), (px - 0.24, py - 0.49)])
    S.append([(px + 0.15, py - 0.40), (px + 0.24, py - 0.49)])
    S.append([(px - 0.09, py + 0.13), (px + 0.02, py + 0.07), (px + 0.09, py + 0.13)])  # beak
    S.append(circle(px - 0.10, py + 0.22, 0.042, n=12))
    S.append(circle(px + 0.10, py + 0.22, 0.042, n=12))
    return S


def screen_frame(ax, M, tc, uc, y):
    """Solve the two signs that make the drawing upright and unmirrored, by projecting the POSED
    verso's own in-plane basis through the money-shot camera. +X of the drawing is whichever way
    along the spine moves right on screen; +Y is whichever way across the page moves up."""
    cam = bpy.data.objects['MoneyShotCam']
    vl.update()
    R = M.to_3x3()
    o = ax['A'] + ax['d'] * tc + ax['n'] * uc
    P = M @ to_blend(Vector((o.x, y, o.z)))
    et = R @ to_blend(ax['d'])
    eu = R @ to_blend(ax['n'])
    p0 = world_to_camera_view(sc, cam, P)
    p1 = world_to_camera_view(sc, cam, P + et * 0.10)
    p2 = world_to_camera_view(sc, cam, P + eu * 0.10)
    st = 1.0 if (p1.x - p0.x) > 0 else -1.0
    su = 1.0 if (p2.y - p0.y) > 0 else -1.0
    print('  sketch frame: +spine -> screen dx %+.4f dy %+.4f | +u -> dx %+.4f dy %+.4f'
          ' => sign_t %+.0f sign_u %+.0f'
          % (p1.x - p0.x, p1.y - p0.y, p2.x - p0.x, p2.y - p0.y, st, su), flush=True)
    return st, su


def ink(ax, M, t0, t1, u0, u1, y, mat):
    """Flat ribbons, not tubes. A tube of graphite is a cylinder whose lit side is a highlight, and
    at this size the highlight is most of what the vertex bake stores — the line goes silver. A
    strip lying in the page's own plane bakes the page's own light and reads as a mark on paper."""
    S = strokes()
    st, su = screen_frame(ax, M, 0.5 * (t0 + t1), 0.5 * (u0 + u1), y)
    mx = max(abs(x) for stk in S for x, _ in stk)
    my = max(abs(v) for stk in S for _, v in stk)
    # ONE uniform scale for both axes. The page is twice as wide as the drawing is tall, and
    # fitting each axis independently would stretch the bird into a different animal.
    s = min((t1 - t0) * 0.5 * 0.92 / mx, (u1 - u0) * 0.5 * 0.92 / my)
    tc, uc = 0.5 * (t0 + t1), 0.5 * (u0 + u1)

    verts, quads, npt = [], [], 0
    for stk in S:
        pts = [(tc + st * x * s, uc + su * v * s) for x, v in stk]
        base = len(verts)
        for k, (pt, pu) in enumerate(pts):
            a = pts[max(k - 1, 0)]
            b = pts[min(k + 1, len(pts) - 1)]
            dt, du = b[0] - a[0], b[1] - a[1]
            ln = math.hypot(dt, du) or 1.0
            ot, ou = -du / ln * INK_W * 0.5, dt / ln * INK_W * 0.5
            for sgn in (-1.0, 1.0):
                p = ax['A'] + ax['d'] * (pt + sgn * ot) + ax['n'] * (pu + sgn * ou)
                verts.append(to_blend(Vector((p.x, y, p.z))))
        for k in range(len(pts) - 1):
            a = base + k * 2
            quads.append((a, a + 1, a + 3, a + 2))
        npt += len(pts)
    ob = emit('Book2_Ink', quads, verts, mat, want_up=False)
    print('  %-13s %d strokes / %d points, ribbon %.4f wide, scale %.4f, %d verts'
          % ('Book2_Ink', len(S), npt, INK_W, s, len(ob.data.vertices)), flush=True)
    return ob


# ================================================================= 5. pose
def rotate_mesh(ob, M):
    """Rotate an object's GEOMETRY, leaving its transform alone — the export ships vertices, and a
    pose that lived in an object matrix would have to be applied later anyway."""
    Ml = ob.matrix_world.inverted() @ M @ ob.matrix_world
    ob.data.transform(Ml)
    ob.data.update()


def rotate_slab(ax, M):
    ob = bpy.data.objects[BOOK]
    Ml = ob.matrix_world.inverted() @ M @ ob.matrix_world
    n = 0
    for v in ob.data.vertices:
        if to_lab(ob.matrix_world @ v.co).y > ax['thr']:
            v.co = Ml @ v.co
            n += 1
    ob.data.update()
    print('  posed %s: %d slab verts rotated (the shell and spine stay)' % (BOOK, n), flush=True)


# ================================================================= 6. run
def build():
    ax = derive_axis()
    for n in NEW:
        purge(n)

    paper = bpy.data.materials['POL_PAPER']
    pencil = pencil_material()

    tc = 0.5 * (ax['t_min'] + ax['t_max'])
    th = 0.5 * (ax['t_max'] - ax['t_min']) * INSET
    t0, t1 = tc - th, tc + th
    uh = 0.5 * ax['u_max'] * INSET
    u_lo, u_hi = 0.5 * ax['u_max'] - uh, 0.5 * ax['u_max'] + uh

    y_verso = ax['bot'] - DY_VERSO
    y_ink = ax['bot'] - DY_INK
    y_gut = ax['bot'] - DY_GUT
    y_page = ax['bot'] - DY_PAGE

    M = open_matrix(ax, OPEN_DEG)

    page = panel('Book2_PageR', ax, t0, t1, max(u_lo, U_PAGE), u_hi, y_page, paper, want_up=True)
    gut = panel('Book2_Gutter', ax, t0, t1, U_PAGE, U_PAGE + GUT_W, y_gut, pencil, want_up=True)
    # The panel reaches down to cover the slab's black underside; the drawing does not follow it in.
    verso = panel('Book2_Verso', ax, t0, t1, max(u_lo, U_PANEL), u_hi, y_verso, paper, want_up=False)
    ik = ink(ax, M, t0, t1, max(u_lo, U_FLEX), u_hi, y_ink, pencil)

    for ob in (verso, ik):
        rotate_mesh(ob, M)
    rotate_slab(ax, M)
    return ax, M, [page, gut, verso, ik]


# WHY THE BAKE IS PER-LAYER AND NOT PER-SHIPPED-OBJECT
# ===================================================
# The first cut baked the two JOINED objects, and 57 of the verso's 264 paper vertices came back
# PURE BLACK — scattered across the panel in the pattern of the drawing. That is not a bug in the
# bake, it is the bake being right about a question nobody meant to ask: the ink ribbons sit 0.4 mm
# in front of the verso, so a paper vertex behind a stroke has its ENTIRE hemisphere occluded and
# receives no light at all.
#
# It cannot be left. Vertex colour INTERPOLATES: a black vertex drags its whole one-cell
# neighbourhood down, and a cell here is ~0.05 units — about seven screen pixels against a stroke
# only two wide. The drawing would ship wearing a grey bruise three times its own size.
#
# The fix is to bake the question that was meant: a decal does not shade the surface it covers.
# Each base layer is baked with the layer lying on top of it hidden, so the paper bakes as paper and
# the mark bakes as a mark. The cover slab stays visible throughout — the shadow the standing cover
# throws is real light and is exactly what the bake is for. Eight bakes rather than four, which is
# the cost of the layers being separable at bake time and only then joined for shipping.
OVER = {'Book2_PageR': ['Book2_Gutter'], 'Book2_Verso': ['Book2_Ink']}


def bake(objs, tmp):
    import t71_bake
    os.makedirs(tmp, exist_ok=True)
    sc.render.engine = 'CYCLES'
    base = t71_bake.capture_rig()
    print('  base rig:', base, flush=True)

    def pass_(attr):
        for ob in objs:
            hid = [bpy.data.objects[n] for n in OVER.get(ob.name, []) if n in bpy.data.objects]
            for h in hid:
                h.hide_render = True
            t71_bake.bake_into(ob, attr)
            for h in hid:
                h.hide_render = False
            print('  baked %s %-13s (hid %s)' % (attr, ob.name, [h.name for h in hid] or 'nothing'),
                  flush=True)

    pass_('lit')
    t71_bake.rig_scale(t71_bake.DIM_LIGHT, t71_bake.DIM_ENV, base)
    pass_('dim')
    t71_bake.rig_scale(1.0, 1.0, base)
    for ob in objs:
        t71_bake.report_span(ob)
        for name in ('lit', 'dim'):
            t71_bake.view_transform_attr(ob, name, tmp)


def export(static, vso, path):
    import t71_export
    for ob in (static, vso):
        t71_export.one_material(ob, t71_export.vertex_material('T92_' + ob.name.upper(),
                                                               metallic=0.0, roughness=1.0))
        t71_export.strip_uvs(ob)
        idx = ob.data.color_attributes.find('lit')
        ob.data.color_attributes.active_color_index = idx
        ob.data.color_attributes.render_color_index = idx
    objs = [static, vso]
    for o in vl.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    vl.objects.active = static
    win = bpy.context.window_manager.windows[0]
    with bpy.context.temp_override(window=win, screen=win.screen, scene=sc, view_layer=vl,
                                   active_object=static, selected_objects=objs,
                                   selected_editable_objects=objs, object=static):
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format='GLB',
            use_selection=True,
            export_yup=True,
            export_apply=False,
            export_materials='EXPORT',
            export_all_vertex_colors=True,
            export_vertex_color='ACTIVE',
            export_normals=False,
            export_tangents=False,
            export_texcoords=False,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
            export_extras=False,
            export_draco_mesh_compression_enable=False,
        )
    raw = os.path.getsize(path)
    with open(path, 'rb') as fh:
        gz = len(gzip.compress(fh.read(), 9))
    return raw, gz


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(BLEND_DIR, exist_ok=True)
    # FIRST WRITE, BEFORE ANYTHING ELSE: the master is read-only, and the cheapest guarantee of
    # that is that `bpy.data.filepath` stops pointing at it before a single datablock changes.
    out_blend = os.path.join(BLEND_DIR, 't92_book_build.blend')
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    use_gpu()

    ax, M, objs = build()
    posed = os.path.join(BLEND_DIR, 't92_book_posed.blend')
    bpy.ops.wm.save_as_mainfile(filepath=posed)
    print('  posed blend -> %s' % posed, flush=True)
    if STAGE == 'build':
        print('T92_BOOK_RESULT stage=build only', flush=True)
        return

    print('\n=== BAKE ===', flush=True)
    bake(objs, os.path.join(OUT_DIR, 'cm'))

    print('\n=== JOIN ===', flush=True)
    import t71_prep
    static = t71_prep.join([bpy.data.objects['Book2_PageR'], bpy.data.objects['Book2_Gutter']],
                           'BookStatic')
    vso = t71_prep.join([bpy.data.objects['Book2_Verso'], bpy.data.objects['Book2_Ink']],
                        'BookVerso')
    for ob in (static, vso):
        dark = sum(1 for c in ob.data.color_attributes['lit'].data
                   if (c.color[0] + c.color[1] + c.color[2]) / 3.0 < 0.05)
        print('  %-11s %d verts, %d baked below 0.05 luminance' % (ob.name, len(ob.data.vertices), dark),
              flush=True)
    baked = os.path.join(BLEND_DIR, 't92_book_baked.blend')
    bpy.ops.wm.save_as_mainfile(filepath=baked)

    print('\n=== UN-POSE + EXPORT ===', flush=True)
    rotate_mesh(vso, M.inverted())
    glb = os.path.join(OUT_DIR, 't92_book_new.glb')
    raw, gz = export(static, vso, glb)
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)

    print('\nT92_BOOK_RESULT axis point (lab) = (%.6f, %.6f, %.6f)'
          % (ax['axis_piv'].x, ax['axis_piv'].y, ax['axis_piv'].z))
    print('T92_BOOK_RESULT axis dir   (lab) = (%.6f, %.6f, %.6f)' % (ax['d'].x, ax['d'].y, ax['d'].z))
    print('T92_BOOK_RESULT axis top-edge point (lab) = (%.6f, %.6f, %.6f)'
          % (ax['axis_top'].x, ax['axis_top'].y, ax['axis_top'].z))
    print('T92_BOOK_RESULT open angle = %.1f deg' % OPEN_DEG)
    print('T92_BOOK_RESULT BookStatic verts = %d (PageR + Gutter, never moves)'
          % len(static.data.vertices))
    print('T92_BOOK_RESULT BookVerso verts = %d (Verso + Ink, rotates with the cover)'
          % len(vso.data.vertices))
    print('T92_BOOK_RESULT glb = %s' % glb)
    print('T92_BOOK_RESULT bytes raw = %d   gzip -9 = %d' % (raw, gz))
    print('T92_BOOK_RESULT blend = %s' % out_blend)
    print('T92_BOOK_RESULT posed blend = %s' % posed)


main()
