/**
 * E4 PAINTED — THE CAPTURE HARNESS.
 *
 * The lane is judged on frames, so the frames have to be honest. Two things
 * routinely make them lie, and both are gated here rather than trusted:
 *
 *  1. THE STALE SERVER. A backgrounded `next dev`/`next start` swallows
 *     EADDRINUSE and exits quietly, leaving an OLDER process (often another
 *     worktree's) still bound to the port. Every capture then photographs a
 *     build nobody is looking at, and the review is worthless. `assertLiveBuild`
 *     round-trips a marker file through the server's own static root and
 *     re-serves the art manifest for comparison, so a foreign or stale root
 *     fails the run loudly instead of producing a beautiful lie.
 *
 *  2. THE UNSETTLED FRAME. r3f boots, then art streams in over several hundred
 *     ms; a `waitForTimeout` that happened to be long enough yesterday
 *     photographs a half-textured scene today. `settle()` polls real frames and
 *     only returns once consecutive frames stop CHANGING.
 *
 * HEADED, always. Headless Chromium and hidden/background tabs suspend rAF, so
 * an r3f scene either never boots or renders a frame from the wrong clock.
 *
 * `?sbidle=1` is on every URL by default and that is deliberate: `?sbpose=<n>`
 * alone freezes the idle clock (idle-life.ts), which kills every glint and sway
 * and photographs the scene as a still life. Because the idle clock is running,
 * the settle test is a THRESHOLD on frame-to-frame change, not exact equality —
 * see `settle`.
 *
 * usage:
 *   node scripts/e4/shoot.mjs [--port 3161] [--out <dir>] [--tag <prefix>]
 *                             [--shot <name>=<query>] [--only <name,name>]
 *                             [--keep-marker] [--timeout <ms>]
 *
 * Adding a frame is one `--shot` flag, or one line in SHOTS below.
 */

import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(SCRIPT_DIR, '..', '..')

// The shot list. `query` is appended to /labs/storybook — `sbidle=1` included
// on every one, see the header. `settle` may be relaxed per shot for poses that
// carry more idle motion than the reading rest pose.
const SHOTS = [
  { name: 'rest', query: 'view=book&sbpose=2&sbidle=1' },
  { name: 'turn-025', query: 'view=book&sbpose=2:0.25:next&sbidle=1' },
  { name: 'turn-050', query: 'view=book&sbpose=2:0.50:next&sbidle=1' },
  { name: 'turn-075', query: 'view=book&sbpose=2:0.75:next&sbidle=1' },
]

const VIEWPORT = { width: 1600, height: 900 }
const MARKER_REL = 'labs/storybook/e4-build-marker.json'
const MARKER_DISK = path.join(REPO_ROOT, 'public', MARKER_REL)

function parseArgs(argv) {
  const out = { port: '3161', out: null, tag: '', shots: [], only: null, keepMarker: false, timeout: 60000 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--port') out.port = next()
    else if (a === '--out') out.out = next()
    else if (a === '--tag') out.tag = next()
    else if (a === '--only') out.only = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--timeout') out.timeout = Number(next())
    else if (a === '--keep-marker') out.keepMarker = true
    else if (a === '--shot') {
      const raw = next()
      const eq = raw.indexOf('=')
      if (eq < 0) throw new Error(`--shot wants <name>=<query>, got ${raw}`)
      out.shots.push({ name: raw.slice(0, eq), query: raw.slice(eq + 1) })
    } else throw new Error(`unknown flag ${a}`)
  }
  return out
}

const git = (...args) =>
  execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

/**
 * An id for the working tree AS IT IS RIGHT NOW: HEAD, plus a digest over the
 * uncommitted diff and the untracked listing. Two different worktrees, or the
 * same worktree before and after an edit, never collide.
 *
 * The marker file itself is excluded — it is written INTO the tree by this
 * script, so including it would make the id depend on itself.
 */
function treeId() {
  const head = git('rev-parse', 'HEAD')
  const status = git('status', '--porcelain=v1')
    .split('\n')
    .filter((l) => l && !l.includes(MARKER_REL))
    .join('\n')
  const diff = git('diff', 'HEAD', '--', '.', ':!public/' + MARKER_REL)
  return `${head}-${createHash('sha1').update(status).update('\0').update(diff).digest('hex').slice(0, 16)}`
}

/**
 * THE STALE-SERVER GATE.
 *
 * Round-trips a freshly written marker through the server's static root, then
 * re-fetches the art manifest and compares it byte-for-byte with the one on
 * disk. Together those two prove the process answering on this port is serving
 * THIS worktree with THIS content.
 *
 * What it catches: another worktree's server on the port; a server started from
 * a different repo root; a stale static/CDN layer in front; the art pipeline
 * having been re-run since the server's assets were built.
 *
 * What it does NOT catch: the same worktree served by a stale PRODUCTION build
 * (`next start` over an old .next) — public/ is read straight off disk there, so
 * the marker passes while the JS is old. Pass `--tag` sparingly and prefer
 * `pnpm dev`, which compiles on demand. This limit is stated rather than
 * papered over.
 */
async function assertLiveBuild(base, id) {
  await mkdir(path.dirname(MARKER_DISK), { recursive: true })
  await writeFile(MARKER_DISK, JSON.stringify({ treeId: id, worktree: REPO_ROOT, at: Date.now() }, null, 2) + '\n')

  const url = `${base}/${MARKER_REL}?t=${Date.now()}`
  let res
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch (err) {
    throw new Error(
      `no server answering on ${base} (${err?.message ?? err}).\n` +
        `Start this lane's own server first:  pnpm dev -p ${new URL(base).port}\n` +
        `NEVER touch port 3123 — it belongs to another team.`
    )
  }
  if (!res.ok) {
    throw new Error(
      `${base} answered ${res.status} for the build marker.\n` +
        `Something IS bound to this port but it is not serving this worktree's public/ — ` +
        `almost certainly a stale server from another worktree. Every capture would be a lie. ` +
        `Find and stop that process (only one you started), then re-run.`
    )
  }
  const served = await res.json().catch(() => null)
  if (served?.treeId !== id) {
    throw new Error(
      `build-marker MISMATCH on ${base}.\n  served:  ${served?.treeId ?? '(unparseable)'}\n` +
        `  wanted:  ${id}\n  worktree in served marker: ${served?.worktree ?? '(none)'}\n` +
        `The server on this port is serving a different tree. Captures aborted.`
    )
  }

  // Second, independent check: the art the page will actually load.
  const diskManifest = await readFile(
    path.join(REPO_ROOT, 'public', 'labs', 'storybook', 'art', 'manifest.json'),
    'utf8'
  )
  const servedManifest = await (
    await fetch(`${base}/labs/storybook/art/manifest.json?t=${Date.now()}`, { cache: 'no-store' })
  ).text()
  const norm = (s) => s.replace(/\r\n/g, '\n').trim()
  if (norm(servedManifest) !== norm(diskManifest)) {
    const d = JSON.parse(norm(diskManifest))
    const s = JSON.parse(norm(servedManifest) || '[]')
    throw new Error(
      `served art manifest != on-disk art manifest (${s.length} ids served, ${d.length} on disk).\n` +
        `The server is not reading this worktree's art directory. Re-run the art pipeline, ` +
        `or stop the stale server.`
    )
  }
  process.stdout.write(`build marker OK  ${id}  (${JSON.parse(norm(diskManifest)).length} art ids served)\n`)
}

/**
 * Waits until the scene stops CHANGING, by looking at real frames.
 *
 * Exact pixel equality is the wrong test here: `?sbidle=1` leaves the idle clock
 * running on purpose, so a correctly-rendered scene never repeats a frame. What
 * separates "still loading" from "settled and breathing" is the SIZE of the
 * change — art popping in moves whole regions, idle sway moves a few percent of
 * pixels by a few levels. So: sample frames, measure the fraction of pixels that
 * moved appreciably, and require that fraction to sit under `tol` for `runs`
 * consecutive samples. An exactly-repeated frame (idle off) short-circuits.
 */
async function settle(page, { tol = 0.02, runs = 3, interval = 250, timeout = 30000 } = {}) {
  const deadline = Date.now() + timeout
  let prev = null
  let calm = 0
  let last = 1
  while (Date.now() < deadline) {
    const buf = await page.screenshot({ type: 'png' })
    if (prev) {
      if (buf.equals(prev)) return { changed: 0, calm: runs, exact: true }
      last = await page.evaluate(diffFraction, [prev.toString('base64'), buf.toString('base64')])
      calm = last <= tol ? calm + 1 : 0
      if (calm >= runs) return { changed: last, calm, exact: false }
    }
    prev = buf
    await page.waitForTimeout(interval)
  }
  process.stderr.write(
    `  WARNING: never settled within ${timeout}ms (last frame delta ${(last * 100).toFixed(2)}%, ` +
      `tolerance ${(tol * 100).toFixed(2)}%). Capturing anyway — treat this frame with suspicion.\n`
  )
  return { changed: last, calm, exact: false, timedOut: true }
}

/** Runs IN THE PAGE: decodes two PNG frames and returns the fraction of pixels
 *  that moved by more than 8 levels in any channel. Done in-page so the harness
 *  needs no image decoder of its own. */
function diffFraction([aB64, bB64]) {
  const load = (b64) =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.src = 'data:image/png;base64,' + b64
    })
  return Promise.all([load(aB64), load(bB64)]).then(([a, b]) => {
    const W = Math.min(a.width, b.width)
    const H = Math.min(a.height, b.height)
    const scale = Math.min(1, 480 / Math.max(W, H)) // compare downscaled: fast, and immune to single-pixel dither
    const w = Math.max(1, Math.round(W * scale))
    const h = Math.max(1, Math.round(H * scale))
    const grab = (img) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d', { willReadFrequently: true })
      g.drawImage(img, 0, 0, w, h)
      return g.getImageData(0, 0, w, h).data
    }
    const da = grab(a)
    const db = grab(b)
    let moved = 0
    for (let i = 0; i < da.length; i += 4) {
      if (
        Math.abs(da[i] - db[i]) > 8 ||
        Math.abs(da[i + 1] - db[i + 1]) > 8 ||
        Math.abs(da[i + 2] - db[i + 2]) > 8
      ) {
        moved++
      }
    }
    return moved / (w * h)
  })
}

/**
 * TEXTURE-MEMORY PROBE, installed before any page script runs.
 *
 * r3f exposes no renderer handle on this page (no `canvas.__r3f`, no global), so
 * asking three.js for `gl.info.memory` is not available. Measuring one layer
 * lower is better anyway: wrapping the WebGL upload calls counts the bytes that
 * actually reach the driver, no matter which abstraction asked for them.
 *
 * `liveBytes` is real residency — every texture's allocation is recorded against
 * its GL object and subtracted again on deleteTexture — so it is directly
 * comparable across two builds. `uploadedBytes` is cumulative and will exceed it
 * whenever the warm window has swapped textures in and out.
 *
 * Assumes 4 bytes/texel (the scene is RGBA8 throughout) and adds the standard
 * 4/3 mip-pyramid factor for mipmapped textures.
 */
const TEXTURE_PROBE = `(() => {
  const S = { uploads: 0, uploadedBytes: 0, liveBytes: 0, live: 0, mipmapped: 0, byDim: {} };
  window.__e4Tex = S;
  const sizes = new WeakMap();
  const protos = [
    typeof WebGLRenderingContext !== 'undefined' && WebGLRenderingContext.prototype,
    typeof WebGL2RenderingContext !== 'undefined' && WebGL2RenderingContext.prototype,
  ].filter(Boolean);
  const bound = (gl) => { try { return gl.getParameter(gl.TEXTURE_BINDING_2D); } catch (e) { return null; } };
  const charge = (gl, w, h, mips) => {
    if (!(w > 0 && h > 0)) return;
    const bytes = Math.round(w * h * 4 * (mips ? 4 / 3 : 1));
    S.uploads++; S.uploadedBytes += bytes;
    if (mips) S.mipmapped++;
    const k = w + 'x' + h; S.byDim[k] = (S.byDim[k] || 0) + 1;
    const tex = bound(gl);
    if (tex) {
      if (sizes.has(tex)) { S.liveBytes -= sizes.get(tex); S.live--; }
      sizes.set(tex, bytes); S.liveBytes += bytes; S.live++;
    }
  };
  for (const P of protos) {
    const tex2d = P.texImage2D;
    P.texImage2D = function (...a) {
      try {
        if (a[1] === 0) {
          if (typeof a[3] === 'number' && typeof a[4] === 'number') charge(this, a[3], a[4], false);
          else if (a[5]) charge(this, a[5].width | 0, a[5].height | 0, false);
        }
      } catch (e) {}
      return tex2d.apply(this, a);
    };
    if (P.texStorage2D) {
      const st = P.texStorage2D;
      P.texStorage2D = function (...a) {
        try { charge(this, a[3], a[4], (a[1] | 0) > 1); } catch (e) {}
        return st.apply(this, a);
      };
    }
    const del = P.deleteTexture;
    P.deleteTexture = function (t) {
      try { if (t && sizes.has(t)) { S.liveBytes -= sizes.get(t); S.live--; sizes.delete(t); } } catch (e) {}
      return del.apply(this, arguments);
    };
  }
})()`

const mb = (b) => +(b / 1048576).toFixed(1)

async function readTextureStats(page) {
  const s = await page.evaluate(() => window.__e4Tex ?? null).catch(() => null)
  if (!s) return null
  const top = Object.entries(s.byDim)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([d, n]) => `${d}x${n}`)
    .join(' ')
  return {
    liveMB: mb(s.liveBytes),
    uploadedMB: mb(s.uploadedBytes),
    liveTextures: s.live,
    uploads: s.uploads,
    topDims: top,
  }
}

/** Median rAF interval over ~2s — what the reader's eye actually gets. */
async function readFrameTime(page) {
  return page
    .evaluate(
      () =>
        new Promise((resolve) => {
          const ts = []
          let last = performance.now()
          const tick = (now) => {
            ts.push(now - last)
            last = now
            if (ts.length < 120) requestAnimationFrame(tick)
            else resolve(ts)
          }
          requestAnimationFrame(tick)
          setTimeout(() => resolve(ts), 4000)
        })
    )
    .then((ts) => {
      const s = ts.slice(5).sort((a, b) => a - b)
      if (s.length === 0) return null
      return {
        samples: s.length,
        medianMs: +s[Math.floor(s.length / 2)].toFixed(2),
        p95Ms: +s[Math.floor(s.length * 0.95)].toFixed(2),
      }
    })
    .catch(() => null)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const base = `http://localhost:${args.port}`
  const outDir = args.out ? path.resolve(args.out) : path.join(REPO_ROOT, '.superpowers', 'e4-candidate', 'shots')
  const shots = [...SHOTS, ...args.shots].filter((s) => !args.only || args.only.includes(s.name))
  if (shots.length === 0) throw new Error(`--only matched no shots (have: ${[...SHOTS, ...args.shots].map((s) => s.name).join(', ')})`)

  const id = treeId()
  await mkdir(outDir, { recursive: true })

  let browser = null
  try {
    await assertLiveBuild(base, id)

    // HEADED. Headless suspends rAF hard enough that r3f never boots; a hidden
    // or background tab does the same. Do not "optimise" this to headless.
    browser = await chromium.launch({ headless: false, args: ['--window-position=0,0'] })
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
    await context.addInitScript(TEXTURE_PROBE)
    const page = await context.newPage()

    const failures = []
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') failures.push(`console.error: ${m.text()}`)
    })

    const written = []
    for (const shot of shots) {
      const url = `${base}/labs/storybook?${shot.query}`
      process.stdout.write(`\n${shot.name}  ${url}\n`)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: args.timeout })
      await page.waitForSelector('canvas', { timeout: args.timeout })
      // The store flips `booted` once the scene's first real frame is up.
      await page
        .waitForFunction(() => window.__sbStore?.getState?.().booted === true, { timeout: args.timeout })
        .catch(() => process.stderr.write('  (no __sbStore.booted signal — falling back to frame settling alone)\n'))
      // Park the pointer out of the scene so parallax/cursor art is not baked
      // into the frame at whatever position the window happened to open at.
      await page.mouse.move(8, 8)

      const s = await settle(page, { timeout: args.timeout })
      process.stdout.write(
        `  settled: ${s.exact ? 'exact frame repeat' : `${(s.changed * 100).toFixed(2)}% of pixels moving`}` +
          `${s.timedOut ? ' (TIMED OUT)' : ''}\n`
      )

      const file = path.join(outDir, `${args.tag}${shot.name}.png`)
      await page.screenshot({ path: file, type: 'png' })
      written.push(file)

      // Perf is read at the FIRST shot only — that is the reading rest pose,
      // the one the budget is written against, and re-measuring per shot would
      // triple the run for numbers nobody compares.
      if (shot === shots[0]) {
        const tex = await readTextureStats(page)
        const frame = await readFrameTime(page)
        if (tex) {
          process.stdout.write(
            `  texmem: live ${tex.liveMB} MB in ${tex.liveTextures} textures ` +
              `(uploaded ${tex.uploadedMB} MB over ${tex.uploads} calls)\n  texdims: ${tex.topDims}\n`
          )
        }
        if (frame) {
          process.stdout.write(`  frame: median ${frame.medianMs}ms  p95 ${frame.p95Ms}ms  (n=${frame.samples})\n`)
        }
      }
    }

    process.stdout.write(`\nwrote ${written.length} shot(s):\n`)
    for (const f of written) process.stdout.write(`  ${f}\n`)
    if (failures.length > 0) {
      process.stdout.write(`\npage reported ${failures.length} error(s):\n`)
      for (const f of failures.slice(0, 12)) process.stdout.write(`  ${f}\n`)
    }
  } finally {
    if (browser) await browser.close()
    if (!args.keepMarker) await rm(MARKER_DISK, { force: true })
  }
}

main().catch((e) => {
  process.stderr.write(`\nshoot: ${e?.message ?? e}\n`)
  process.exitCode = 1
})
