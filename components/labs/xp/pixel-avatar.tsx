// Pixel avatar — transcribed EXACTLY from scripts/posters/main-poster.html
// (itself transcribed from components/sections/hero.tsx), 32×37 grid, light-mode colors.

type Px = [number, number, number, number]

const BUZZ_TOP: Px[] = [[11, 2, 10, 1], [10, 3, 12, 1], [9, 4, 2, 1], [21, 4, 2, 1]]
const BUZZ_FADE: Px[] = [[11, 4, 10, 1], [9, 5, 1, 2], [22, 5, 1, 2]]
const FACE: Px[] = [
  [10, 5, 12, 2], [9, 7, 14, 2], [10, 9, 12, 3], [11, 12, 10, 1], [12, 13, 8, 1],
  [8, 7, 1, 2], [23, 7, 1, 2], [12, 14, 8, 2],
]
const NECK_SHADOW: Px[] = [[13, 14, 6, 1]]
const BROWS: Px[] = [[11, 5, 3, 1], [18, 5, 3, 1]]
const EYE_WHITES: Px[] = [[11, 7, 3, 2], [18, 7, 3, 2]]
const PUPILS: Px[] = [[12, 7, 1, 2], [19, 7, 1, 2]]
const NOSE_SHADOW: Px[] = [[15, 9, 2, 2]]
const MOUTH: Px[] = [[14, 11, 3, 1]]
const STUBBLE: Px[] = [[11, 12, 10, 1], [12, 13, 8, 1]]
const TEE: Px[] = [
  [10, 15, 3, 1], [19, 15, 3, 1], [6, 16, 20, 1], [4, 17, 24, 1], [4, 18, 24, 5],
  [6, 23, 20, 5], [1, 17, 3, 5], [28, 17, 3, 5],
]
const COLLAR: Px[] = [[13, 16, 6, 1]]
const PECS: Px[] = [[10, 20, 5, 1], [17, 20, 5, 1]]
const SWORD_BLADE: Px[] = [[14, 22, 2, 1], [15, 21, 2, 1], [16, 20, 2, 1], [17, 19, 2, 1], [18, 18, 2, 1]]
const SWORD_HILT: Px[] = [
  [12, 20, 1, 1], [13, 21, 1, 1], [15, 23, 1, 1], [16, 24, 1, 1],
  [13, 23, 1, 1], [12, 24, 1, 1], [11, 25, 1, 1],
]
const ARMS: Px[] = [[1, 22, 3, 5], [28, 22, 3, 5]]
const HANDS: Px[] = [[1, 27, 3, 2], [28, 27, 3, 2]]
const JEANS: Px[] = [[8, 28, 16, 2], [8, 30, 7, 4], [17, 30, 7, 4]]
const BOOTS: Px[] = [[7, 34, 8, 2], [17, 34, 8, 2]]

const LAYERS: { rects: Px[]; fill: string }[] = [
  { rects: BUZZ_TOP, fill: '#292524' },
  { rects: BUZZ_FADE, fill: '#57534e' },
  { rects: FACE, fill: '#eec9a2' },
  { rects: NECK_SHADOW, fill: 'rgba(217,168,120,0.7)' },
  { rects: BROWS, fill: '#57534e' },
  { rects: EYE_WHITES, fill: '#fafaf9' },
  { rects: PUPILS, fill: '#1c1917' },
  { rects: NOSE_SHADOW, fill: 'rgba(217,168,120,0.7)' },
  { rects: MOUTH, fill: '#c08862' },
  { rects: STUBBLE, fill: 'rgba(68,64,60,0.25)' },
  { rects: TEE, fill: '#1c1917' },
  { rects: COLLAR, fill: '#292524' },
  { rects: PECS, fill: '#292524' },
  { rects: SWORD_BLADE, fill: '#e0a878' },
  { rects: SWORD_HILT, fill: '#b0563d' },
  { rects: ARMS, fill: '#eec9a2' },
  { rects: HANDS, fill: '#dfb389' },
  { rects: JEANS, fill: '#57534e' },
  { rects: BOOTS, fill: '#292524' },
]

export function PixelAvatar({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 32 37"
      width={size}
      height={(size * 37) / 32}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {LAYERS.map((layer, i) => (
        <g key={i} fill={layer.fill}>
          {layer.rects.map(([x, y, w, h], j) => (
            <rect key={j} x={x} y={y} width={w} height={h} />
          ))}
        </g>
      ))}
    </svg>
  )
}
