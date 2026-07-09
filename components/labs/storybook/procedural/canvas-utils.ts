/**
 * Shared canvas helpers for the storybook's procedural texture and
 * placeholder-art generators. Client-only — canvas 2D doesn't exist during
 * SSR, so `assertBrowser` throws if called before the component mounts in
 * the browser.
 */

export const assertBrowser = (fnName: string): void => {
  if (typeof document === 'undefined') {
    throw new Error(`storybook/procedural: ${fnName}() is client-only and requires document`)
  }
}

export const createCanvas = (w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('storybook/procedural: 2d canvas context unavailable')
  return { canvas, ctx }
}

export const clampByte = (v: number): number => {
  return Math.min(255, Math.max(0, v))
}
