import type { Hsv, LDrawColorName, LDrawColorShare, ReferenceFaces } from './reference-kit.types.ts'

// The solid colours of the library that a 1999 brick can have (the old greys 7 and 8, not the bluish ones), by LDraw code.
const BRICK_COLOR_CODES: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 20, 22, 25, 26, 27, 28, 29, 68, 70, 73,
  74, 77, 78, 85, 86, 92, 100, 110, 112, 115, 118, 120, 125, 191, 212, 216, 226, 232, 272, 288, 308,
  320, 321, 322, 323, 326, 330, 335, 366, 484,
]
const GREY_SATURATION = 0.22
const BLACK_VALUE = 0.3
const GREY_CODES: readonly number[] = [0, 8, 7, 15]
const COLOR_LINE = /^0\s+!COLOUR\s+(\S+)\s+CODE\s+(\d+)\s+VALUE\s+#([0-9A-Fa-f]{6})/
const BYTE = 255
const MINIMUM_SHARE = 0.005
const HUE_WEIGHT = 2
const SATURATION_WEIGHT = 0.5
const VALUE_WEIGHT = 0.15

const getHsv = (red: number, green: number, blue: number): Hsv => {
  const [r, g, b] = [red / BYTE, green / BYTE, blue / BYTE]
  const maximum = Math.max(r, g, b)
  const range = maximum - Math.min(r, g, b)
  const sector =
    range === 0
      ? 0
      : maximum === r
        ? ((g - b) / range + 6) % 6
        : maximum === g
          ? (b - r) / range + 2
          : (r - g) / range + 4
  return { hue: sector / 6, saturation: maximum === 0 ? 0 : range / maximum, value: maximum }
}

// The colours of an `LDConfig.ldr` text that bricks come in.
export const parseBrickColorNames = (configuration: string): readonly LDrawColorName[] =>
  configuration.split('\n').flatMap((line): readonly LDrawColorName[] => {
    const match = COLOR_LINE.exec(line)
    if (match === null) return []
    const [, name = '', code = '0', hex = '000000'] = match
    return BRICK_COLOR_CODES.includes(Number(code))
      ? [
          {
            code: Number(code),
            name,
            red: parseInt(hex.slice(0, 2), 16),
            green: parseInt(hex.slice(2, 4), 16),
            blue: parseInt(hex.slice(4, 6), 16),
          },
        ]
      : []
  })

const getDistance = (first: Hsv, second: Hsv): number => {
  const hueGap = Math.abs(first.hue - second.hue)
  return (
    Math.min(hueGap, 1 - hueGap) * HUE_WEIGHT +
    Math.abs(first.saturation - second.saturation) * SATURATION_WEIGHT +
    Math.abs(first.value - second.value) * VALUE_WEIGHT
  )
}

// Which colour of the library each triangle of the faces is, and how many triangles (by area weight 1) each colour has. The model's
// colours are shaded, so a grey is told by its lightness, a colour by its hue.
export const countLDrawColors = (
  faces: ReferenceFaces,
  palette: readonly LDrawColorName[]
): readonly LDrawColorShare[] => {
  const triangleCount = faces.colors.length / 3
  const triangles = Array.from({ length: triangleCount }, (_unused, index) => ({
    color: getHsv(
      faces.colors[index * 3] ?? 0,
      faces.colors[index * 3 + 1] ?? 0,
      faces.colors[index * 3 + 2] ?? 0
    ),
  }))
  const counts = new Map<number, number>()
  for (const { color } of triangles) {
    // A dark triangle is black whatever its tint: the game's blacks are shaded bluish and would otherwise match a blue.
    const isGrey = color.saturation < GREY_SATURATION || color.value < BLACK_VALUE
    const candidates = palette.filter((entry) =>
      isGrey ? GREY_CODES.includes(entry.code) : !GREY_CODES.includes(entry.code)
    )

    const best = candidates
      .map((entry) => ({
        entry,
        distance: isGrey
          ? Math.abs(color.value - getHsv(entry.red, entry.green, entry.blue).value)
          : getDistance(color, getHsv(entry.red, entry.green, entry.blue)),
      }))
      .sort((first, second) => first.distance - second.distance)[0]
    if (best !== undefined) counts.set(best.entry.code, (counts.get(best.entry.code) ?? 0) + 1)
  }
  return palette
    .map((entry) => ({ ...entry, share: (counts.get(entry.code) ?? 0) / triangleCount }))
    .filter((entry) => entry.share >= MINIMUM_SHARE)
    .sort((first, second) => second.share - first.share)
}
