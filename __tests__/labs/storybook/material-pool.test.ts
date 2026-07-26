import { describe, expect, it, vi } from 'vitest'
import { createElement, StrictMode, useEffect, useMemo } from 'react'
import { act, render } from '@testing-library/react'
import * as THREE from 'three'
import {
  acquireMaterial,
  releaseMaterial,
  useGuardedDispose,
  _poolDebugSnapshot,
} from '@/components/labs/storybook/book/material-pool'

describe('material-pool', () => {
  it('two acquires with an identical spec return the SAME object', () => {
    const a = acquireMaterial({ map: null, color: '#ffffff', side: THREE.BackSide })
    const b = acquireMaterial({ map: null, color: '#ffffff', side: THREE.BackSide })
    expect(a).toBe(b)
    releaseMaterial(a)
    releaseMaterial(b)
  })

  it('a differing color never collides with another spec', () => {
    const a = acquireMaterial({ map: null, color: '#ffffff' })
    const b = acquireMaterial({ map: null, color: '#000000' })
    expect(a).not.toBe(b)
    releaseMaterial(a)
    releaseMaterial(b)
  })

  it('a differing side never collides with another spec', () => {
    const a = acquireMaterial({ map: null, color: '#ffffff', side: THREE.FrontSide })
    const b = acquireMaterial({ map: null, color: '#ffffff', side: THREE.BackSide })
    expect(a).not.toBe(b)
    releaseMaterial(a)
    releaseMaterial(b)
  })

  it('a differing map identity never collides, even with equal color/side', () => {
    const mapA = new THREE.Texture()
    const mapB = new THREE.Texture()
    const a = acquireMaterial({ map: mapA, color: '#ffffff' })
    const b = acquireMaterial({ map: mapB, color: '#ffffff' })
    expect(a).not.toBe(b)
    releaseMaterial(a)
    releaseMaterial(b)
  })

  it('null map and a real map never collide (map presence changes the compiled shader)', () => {
    const withMap = acquireMaterial({ map: new THREE.Texture(), color: '#ffffff' })
    const withoutMap = acquireMaterial({ map: null, color: '#ffffff' })
    expect(withMap).not.toBe(withoutMap)
    releaseMaterial(withMap)
    releaseMaterial(withoutMap)
  })

  it('transparent/alphaTest/depthWrite/opacity/vertexColors/visible are all part of the key', () => {
    const base = { map: null, color: '#ffffff' } as const
    const variants = [
      acquireMaterial(base),
      acquireMaterial({ ...base, transparent: true }),
      acquireMaterial({ ...base, alphaTest: 0.1 }),
      acquireMaterial({ ...base, depthWrite: false }),
      acquireMaterial({ ...base, opacity: 0.5 }),
      acquireMaterial({ ...base, vertexColors: true }),
      acquireMaterial({ ...base, visible: false }),
    ]
    const distinct = new Set(variants)
    expect(distinct.size).toBe(variants.length)
    variants.forEach(releaseMaterial)
  })

  it('releasing does not dispose a material while another caller still holds it', () => {
    const spec = { map: null, color: '#123456' } as const
    const a = acquireMaterial(spec)
    const b = acquireMaterial(spec)
    expect(a.isMeshBasicMaterial).toBe(true) // still a live, undisposed material
    releaseMaterial(a)
    // b still holds a reference — re-acquiring the same spec must still
    // return the SAME (not-yet-disposed) object, not a freshly built one.
    const c = acquireMaterial(spec)
    expect(c).toBe(b)
    releaseMaterial(b)
    releaseMaterial(c)
  })

  it('the pool evicts an entry once its ref-count reaches zero — a later acquire with the same spec builds a fresh object', () => {
    const spec = { map: null, color: '#654321' } as const
    const a = acquireMaterial(spec)
    releaseMaterial(a)
    const before = _poolDebugSnapshot().size
    const b = acquireMaterial(spec)
    expect(b).not.toBe(a) // the old entry was evicted+disposed, not reused
    expect(_poolDebugSnapshot().size).toBe(before + 1)
    releaseMaterial(b)
  })

  it('releaseMaterial is a safe no-op for null/undefined/an unpooled material', () => {
    expect(() => releaseMaterial(null)).not.toThrow()
    expect(() => releaseMaterial(undefined)).not.toThrow()
    expect(() => releaseMaterial(new THREE.MeshBasicMaterial())).not.toThrow()
  })

  it('over-releasing a spec below zero does not throw or corrupt the pool for the next acquire', () => {
    const spec = { map: null, color: '#abcdef' } as const
    const a = acquireMaterial(spec)
    releaseMaterial(a)
    releaseMaterial(a) // extra release past zero
    expect(() => acquireMaterial(spec)).not.toThrow()
    const b = acquireMaterial(spec)
    releaseMaterial(b)
  })
})

// E-G6: the blind sweep's continuous `GL_INVALID_VALUE: glGetProgramiv:
// Program object expected` spam traced to `useEffect(() => () =>
// target.dispose(), [target])` — book.tsx's original pattern for every
// useMemo'd material/geometry/texture. React's dev-only StrictMode mount
// rehearsal runs that cleanup once and its (no-op) setup again,
// SYNCHRONOUSLY, right after the real mount, to flush out non-idempotent
// effects — but `useMemo`'s factory is never re-invoked by the rehearsal, so
// the SAME object the mesh keeps rendering with gets disposed while the
// component is, and stays, mounted. Disposing a material also releases the
// (often shader-shared) WebGLProgram it cached, which is what the reported
// spam actually was: three re-querying a program some OTHER still-live
// material had already deleted the GPU side of.
//
// This suite proves the failure mode against the ORIGINAL naive pattern
// first (so a regression in the fix shows up as a genuine dispose-during-
// mount, not a false negative), then proves `useGuardedDispose` — the
// drop-in replacement now used throughout book.tsx — survives the exact
// same rehearsal.
describe('useGuardedDispose (E-G6 StrictMode premature-dispose fix)', () => {
  // Flushes the one microtask useGuardedDispose defers its real dispose
  // call through (see the hook's own doc comment for why: that deferral is
  // exactly what lets a StrictMode replay cancel it).
  async function flushMicrotasks(): Promise<void> {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it('control: a plain useEffect(() => () => target.dispose(), [target]) DOES dispose during the StrictMode mount rehearsal', () => {
    const dispose = vi.fn()
    const target = { dispose }

    // Mirrors the pre-fix book.tsx shape exactly: useMemo builds the object
    // once, a plain effect's cleanup alone disposes it — no guard.
    function Naive() {
      const stable = useMemo(() => target, [])
      useEffect(() => () => stable.dispose(), [stable])
      return null
    }

    act(() => {
      render(createElement(StrictMode, null, createElement(Naive)))
    })

    // The component is still mounted (unmount() was never called) — a
    // correct lifecycle must not have disposed anything yet. It has.
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes the target on real unmount', async () => {
    const dispose = vi.fn()
    const target = { dispose }

    function Consumer() {
      useGuardedDispose(target)
      return null
    }

    const view = render(createElement(Consumer))
    view.unmount()
    await flushMicrotasks()

    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('survives the StrictMode mount rehearsal: does NOT dispose while genuinely mounted, still disposes exactly once on the real unmount', async () => {
    const dispose = vi.fn()
    const target = { dispose }

    function Consumer() {
      useGuardedDispose(target)
      return null
    }

    const view = render(createElement(StrictMode, null, createElement(Consumer)))

    // Flush any microtask the rehearsal's cleanup may have scheduled — the
    // fix's whole point is that the replayed setup already cancelled it.
    await flushMicrotasks()
    expect(dispose).not.toHaveBeenCalled()

    view.unmount()
    await flushMicrotasks()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it("array form (book.tsx's stack-edge texture set) disposes every entry exactly once on real unmount, none early", async () => {
    const targets = [{ dispose: vi.fn() }, { dispose: vi.fn() }, { dispose: vi.fn() }]

    function Consumer() {
      useGuardedDispose(targets)
      return null
    }

    const view = render(createElement(StrictMode, null, createElement(Consumer)))
    await flushMicrotasks()
    for (const t of targets) expect(t.dispose).not.toHaveBeenCalled()

    view.unmount()
    await flushMicrotasks()
    for (const t of targets) expect(t.dispose).toHaveBeenCalledTimes(1)
  })

  it('a null/undefined target is a safe no-op', () => {
    function Consumer() {
      useGuardedDispose(null)
      useGuardedDispose(undefined)
      return null
    }
    expect(() => {
      const view = render(createElement(Consumer))
      view.unmount()
    }).not.toThrow()
  })
})
