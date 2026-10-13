import type {
  FidelityMeasurement,
  ScorePart,
  SilhouetteComparison,
} from './fidelity-metrics.types.ts'

const CHANNELS = 4
const COVERED_THRESHOLD = 127
const BYTE = 255
// sRGB's decoding and the D65 white of CIE Lab.
const SRGB_LINEAR_LIMIT = 0.04045
const SRGB_LINEAR_SLOPE = 12.92
const SRGB_OFFSET = 0.055
const SRGB_SCALE = 1.055
const SRGB_EXPONENT = 2.4
const WHITE_X = 0.95047
const WHITE_Z = 1.08883
const LAB_EPSILON = 216 / 24389
const LAB_KAPPA = 24389 / 27
const LAB_LIGHTNESS_SCALE = 116
const LAB_LIGHTNESS_OFFSET = 16
const LAB_A_SCALE = 500
const LAB_B_SCALE = 200

// A replacement passes when its score reaches this.
export const FIDELITY_PASS_SCORE = 80

// How each measurement turns into a part of the score: the value at which the part is full and the one at which it is empty, and the
// part's weight out of 100. A part that an item cannot measure (no colour overlap, no attachment points) drops out and the others share
// its weight.
const SCORE_PARTS = Object.freeze({
  silhouette: Object.freeze({ full: 0.95, empty: 0.5, weight: 50 }),
  centroid: Object.freeze({ full: 0, empty: 10, weight: 15 }),
  scale: Object.freeze({ full: 0, empty: Math.log(1.3), weight: 10 }),
  color: Object.freeze({ full: 5, empty: 30, weight: 15 }),
  anchors: Object.freeze({ full: 0, empty: 10, weight: 10 }),
})

const getClamped = (value: number): number => Math.min(1, Math.max(0, value))

const getPartValue = (value: number, part: ScorePart) =>
  getClamped((value - part.empty) / (part.full - part.empty))

// The pixels of a silhouette pass that are covered (the drawing is white on a cleared black).
export const getCoverageMask = (pixels: Uint8Array): Uint8Array => {
  const mask = new Uint8Array(pixels.length / CHANNELS)
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    mask[pixel] = (pixels[pixel * CHANNELS] ?? 0) > COVERED_THRESHOLD ? 1 : 0
  }
  return mask
}

const getCentroid = (mask: Uint8Array, width: number): readonly [number, number, number] => {
  let area = 0
  let sumX = 0
  let sumY = 0
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] !== 1) continue
    area += 1
    sumX += pixel % width
    sumY += Math.floor(pixel / width)
  }
  return area === 0 ? [0, 0, 0] : [area, sumX / area, sumY / area]
}

// The overlap of two silhouettes of the same view and the offset of the replacement's centre of area from the original's (pixels; the
// rows of a read-back picture count up, so y is up). Two empty silhouettes agree; one empty one does not overlap at all.
export const compareSilhouettes = (
  original: Uint8Array,
  replacement: Uint8Array,
  width: number
): SilhouetteComparison => {
  let intersection = 0
  let union = 0
  for (let pixel = 0; pixel < original.length; pixel += 1) {
    const isOriginal = original[pixel] === 1
    const isReplacement = replacement[pixel] === 1
    if (isOriginal && isReplacement) intersection += 1
    if (isOriginal || isReplacement) union += 1
  }
  const [originalArea, originalX, originalY] = getCentroid(original, width)
  const [replacementArea, replacementX, replacementY] = getCentroid(replacement, width)
  const isBothCovered = originalArea > 0 && replacementArea > 0
  return Object.freeze({
    intersectionOverUnion: union === 0 ? 1 : intersection / union,
    centroidOffset: Object.freeze<[number, number]>(
      isBothCovered ? [replacementX - originalX, replacementY - originalY] : [0, 0]
    ),
    originalArea,
    replacementArea,
  })
}

const getLinear = (channel: number): number => {
  const value = channel / BYTE
  return value <= SRGB_LINEAR_LIMIT
    ? value / SRGB_LINEAR_SLOPE
    : ((value + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_EXPONENT
}

const getLabComponent = (value: number): number =>
  value > LAB_EPSILON
    ? Math.cbrt(value)
    : (LAB_KAPPA * value + LAB_LIGHTNESS_OFFSET) / LAB_LIGHTNESS_SCALE

// CIE Lab (D65) of a colour of bytes, read as sRGB: the original's framebuffer bytes and the library's colour codes are both display
// values.
export const getLab = (
  red: number,
  green: number,
  blue: number
): readonly [number, number, number] => {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map(getLinear) as [
    number,
    number,
    number,
  ]
  const x = (0.4124 * linearRed + 0.3576 * linearGreen + 0.1805 * linearBlue) / WHITE_X
  const y = 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue
  const z = (0.0193 * linearRed + 0.1192 * linearGreen + 0.9505 * linearBlue) / WHITE_Z
  const [labX, labY, labZ] = [x, y, z].map(getLabComponent) as [number, number, number]
  return [
    LAB_LIGHTNESS_SCALE * labY - LAB_LIGHTNESS_OFFSET,
    LAB_A_SCALE * (labX - labY),
    LAB_B_SCALE * (labY - labZ),
  ]
}

// The mean CIE76 colour difference over the pixels both silhouettes cover, null when they share none. A blended face of the original
// writes no alpha, so coverage comes from the silhouettes, not from the colour passes.
export const getMeanColorDifference = (
  original: Uint8Array,
  replacement: Uint8Array,
  originalMask: Uint8Array,
  replacementMask: Uint8Array
): number | null => {
  let sum = 0
  let count = 0
  for (let pixel = 0; pixel < originalMask.length; pixel += 1) {
    const base = pixel * CHANNELS
    if (originalMask[pixel] !== 1 || replacementMask[pixel] !== 1) continue
    const [originalL, originalA, originalB] = getLab(
      original[base] ?? 0,
      original[base + 1] ?? 0,
      original[base + 2] ?? 0
    )
    const [replacementL, replacementA, replacementB] = getLab(
      replacement[base] ?? 0,
      replacement[base + 1] ?? 0,
      replacement[base + 2] ?? 0
    )
    sum += Math.hypot(originalL - replacementL, originalA - replacementA, originalB - replacementB)
    count += 1
  }
  return count === 0 ? null : sum / count
}

// One number from 0 to 100 for a replacement: half of it the silhouettes' overlap, the rest the placement, size, colour and attachment
// points (see SCORE_PARTS), rounded to a tenth.
export const getFidelityScore = (measurement: FidelityMeasurement): number => {
  const parts = [
    [measurement.meanIntersectionOverUnion, SCORE_PARTS.silhouette],
    [measurement.centroidDistance, SCORE_PARTS.centroid],
    [Math.abs(Math.log(measurement.scaleRatio)), SCORE_PARTS.scale],
    [measurement.meanColorDifference, SCORE_PARTS.color],
    [measurement.meanAnchorDistance, SCORE_PARTS.anchors],
  ] as const
  let weighted = 0
  let totalWeight = 0
  for (const [value, part] of parts) {
    if (value === null || !Number.isFinite(value)) continue
    weighted += getPartValue(value, part) * part.weight
    totalWeight += part.weight
  }
  return totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 1000) / 10
}
