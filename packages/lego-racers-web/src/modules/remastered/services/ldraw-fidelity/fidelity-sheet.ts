import { FidelityView } from './ldraw-fidelity.types.ts'
import type { FidelitySheetRow, ViewPictures } from './fidelity-render.types.ts'

const CHANNELS = 4
const COVERED_THRESHOLD = 127
const LABEL_HEIGHT = 18
const BACKGROUND = '#1d222b'
const LABEL_COLOR = '#e6e6e6'
const LABEL_FONT = '13px sans-serif'
// Both drawings cover the pixel: grey; only the original: red; only the replacement: blue.
const BOTH_COLOR = [150, 150, 150] as const
const ORIGINAL_ONLY_COLOR = [230, 60, 60] as const
const REPLACEMENT_ONLY_COLOR = [60, 120, 240] as const
const OPAQUE = 255

const flipRows = (pixels: Uint8Array, size: number): Uint8ClampedArray<ArrayBuffer> => {
  const flipped = new Uint8ClampedArray(pixels.length)
  const rowLength = size * CHANNELS
  for (let row = 0; row < size; row += 1) {
    flipped.set(
      pixels.subarray(row * rowLength, (row + 1) * rowLength),
      (size - 1 - row) * rowLength
    )
  }
  return flipped
}

const getDifferencePixels = (picture: ViewPictures): Uint8Array => {
  const pixels = new Uint8Array(picture.originalSilhouette.length)
  for (let base = 0; base < pixels.length; base += CHANNELS) {
    const isOriginal = (picture.originalSilhouette[base] ?? 0) > COVERED_THRESHOLD
    const isReplacement = (picture.replacementSilhouette[base] ?? 0) > COVERED_THRESHOLD
    const color = isOriginal
      ? isReplacement
        ? BOTH_COLOR
        : ORIGINAL_ONLY_COLOR
      : isReplacement
        ? REPLACEMENT_ONLY_COLOR
        : null
    if (color === null) continue
    pixels.set([...color, OPAQUE], base)
  }
  return pixels
}

// A sheet for people (the numbers are the judgement): one row per item, its label, then the silhouette difference of each view (grey
// both, red only the original, blue only the replacement) and the flat colours of the original and the replacement in three quarters.
export const drawFidelitySheet = (rows: readonly FidelitySheetRow[]): string => {
  const size = rows[0]?.pictures[0]?.size ?? 1
  const columns = Object.values(FidelityView).length + 2
  const canvas = document.createElement('canvas')
  canvas.width = columns * size
  canvas.height = rows.length * (size + LABEL_HEIGHT)
  const context = canvas.getContext('2d')
  if (context === null) return ''
  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.font = LABEL_FONT
  for (const [rowIndex, row] of rows.entries()) {
    const top = rowIndex * (size + LABEL_HEIGHT)
    context.fillStyle = LABEL_COLOR
    context.fillText(row.label, 4, top + LABEL_HEIGHT - 5)
    const threeQuarter = row.pictures.find((picture) => picture.view === FidelityView.THREE_QUARTER)
    const cells = [
      ...row.pictures.map(getDifferencePixels),
      ...(threeQuarter === undefined
        ? []
        : [threeQuarter.originalColor, threeQuarter.replacementColor]),
    ]
    for (const [column, pixels] of cells.entries()) {
      context.putImageData(
        new ImageData(flipRows(pixels, size), size, size),
        column * size,
        top + LABEL_HEIGHT
      )
    }
  }
  return canvas.toDataURL('image/png')
}
