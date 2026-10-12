import type {
  PixelComparison,
  PixelComparisonInput,
  PixelRegion,
  TextureCoverage,
} from '../pixel-trace.types.ts'

const CHANNEL_COUNT = 4 // @check-allow traced-constants: comparison parameter of the pixel trace, not original behaviour
const RGB_CHANNEL_COUNT = 3 // @check-allow traced-constants: comparison parameter of the pixel trace, not original behaviour
const CELL_SIZE = 16 // @check-allow traced-constants: comparison parameter of the pixel trace, not original behaviour
// A cell joins a region when this many of its pixels differ.
const MINIMUM_DIFFERING_PER_CELL = 12 // @check-allow traced-constants: comparison parameter of the pixel trace, not original behaviour
const UNTEXTURED_LABEL = 'untextured'
const NEIGHBOUR_OFFSETS = [-1, 0, 1] as const

const getDifferingPixels = (input: PixelComparisonInput): Uint8Array => {
  const { reference, port, tolerance } = input
  const differing = new Uint8Array(reference.width * reference.height)
  for (let pixel = 0; pixel < differing.length; pixel++) {
    for (let channel = 0; channel < RGB_CHANNEL_COUNT; channel++) {
      const offset = pixel * CHANNEL_COUNT + channel
      const difference = Math.abs((reference.colors[offset] ?? 0) - (port.colors[offset] ?? 0))
      if (difference > tolerance.channelLevels) {
        differing[pixel] = 1
        break
      }
    }
  }
  return differing
}

const getTextureLabel = (input: PixelComparisonInput, textureIndex: number): string => {
  const hash = input.reference.textureHashes[textureIndex]
  return hash === undefined ? UNTEXTURED_LABEL : (input.textureLabels.get(hash) ?? hash)
}

const getTextureCoverages = (
  input: PixelComparisonInput,
  differing: Uint8Array
): readonly TextureCoverage[] => {
  const pixelCounts = new Map<string, number>()
  const differingCounts = new Map<string, number>()
  differing.forEach((isDifferent, pixel) => {
    const label = getTextureLabel(input, input.reference.textureIndices[pixel] ?? -1)
    pixelCounts.set(label, (pixelCounts.get(label) ?? 0) + 1)
    differingCounts.set(label, (differingCounts.get(label) ?? 0) + isDifferent)
  })
  return [...pixelCounts]
    .map(([label, pixelCount]) =>
      Object.freeze({ label, pixelCount, differingCount: differingCounts.get(label) ?? 0 })
    )
    .sort((first, second) => second.differingCount - first.differingCount)
}

const getCellCounts = (input: PixelComparisonInput, differing: Uint8Array) => {
  const { width, height } = input.reference
  const columns = Math.ceil(width / CELL_SIZE)
  const rows = Math.ceil(height / CELL_SIZE)
  const counts = new Int32Array(columns * rows)
  differing.forEach((isDifferent, pixel) => {
    if (isDifferent === 0) return
    const cell =
      Math.floor(Math.floor(pixel / width) / CELL_SIZE) * columns +
      Math.floor((pixel % width) / CELL_SIZE)
    counts[cell] = (counts[cell] ?? 0) + 1
  })
  return { columns, rows, counts }
}

const getMeans = (totals: readonly number[], count: number): readonly [number, number, number] => [
  Math.round((totals[0] ?? 0) / count),
  Math.round((totals[1] ?? 0) / count),
  Math.round((totals[2] ?? 0) / count),
]

const getRegion = (
  input: PixelComparisonInput,
  differing: Uint8Array,
  cells: readonly number[],
  columns: number
): PixelRegion => {
  const { width } = input.reference
  const cellSet = new Set(cells)
  let left = width
  let top = input.reference.height
  let right = 0
  let bottom = 0
  let differingCount = 0
  const textureCounts = new Map<string, number>()
  const referenceTotals = [0, 0, 0]
  const portTotals = [0, 0, 0]
  differing.forEach((isDifferent, pixel) => {
    if (isDifferent === 0) return
    const row = Math.floor(pixel / width)
    const column = pixel % width
    if (!cellSet.has(Math.floor(row / CELL_SIZE) * columns + Math.floor(column / CELL_SIZE))) return
    left = Math.min(left, column)
    right = Math.max(right, column)
    top = Math.min(top, row)
    bottom = Math.max(bottom, row)
    differingCount += 1
    for (let channel = 0; channel < RGB_CHANNEL_COUNT; channel++) {
      referenceTotals[channel] =
        (referenceTotals[channel] ?? 0) +
        (input.reference.colors[pixel * CHANNEL_COUNT + channel] ?? 0)
      portTotals[channel] =
        (portTotals[channel] ?? 0) + (input.port.colors[pixel * CHANNEL_COUNT + channel] ?? 0)
    }
    const label = getTextureLabel(input, input.reference.textureIndices[pixel] ?? -1)
    textureCounts.set(label, (textureCounts.get(label) ?? 0) + 1)
  })
  return Object.freeze({
    left,
    top,
    right,
    bottom,
    differingCount,
    meanReference: getMeans(referenceTotals, differingCount),
    meanPort: getMeans(portTotals, differingCount),
    dominantTextures: [...textureCounts]
      .map(([label, count]) => Object.freeze({ label, count }))
      .sort((first, second) => second.count - first.count)
      .slice(0, 4), // @check-allow traced-constants: comparison parameter of the pixel trace, not original behaviour
  })
}

// Groups the cells with enough differing pixels into 8-connected regions.
const getRegions = (input: PixelComparisonInput, differing: Uint8Array): readonly PixelRegion[] => {
  const { columns, rows, counts } = getCellCounts(input, differing)
  const visited = new Set<number>()
  const regions: PixelRegion[] = []
  counts.forEach((count, start) => {
    if (count < MINIMUM_DIFFERING_PER_CELL || visited.has(start)) return
    const members: number[] = []
    const pending = [start]
    visited.add(start)
    while (pending.length > 0) {
      const cell = pending.pop() ?? 0
      members.push(cell)
      for (const rowOffset of NEIGHBOUR_OFFSETS) {
        for (const columnOffset of NEIGHBOUR_OFFSETS) {
          const row = Math.floor(cell / columns) + rowOffset
          const column = (cell % columns) + columnOffset
          const neighbour = row * columns + column
          const isInside = row >= 0 && row < rows && column >= 0 && column < columns
          if (
            isInside &&
            !visited.has(neighbour) &&
            (counts[neighbour] ?? 0) >= MINIMUM_DIFFERING_PER_CELL
          ) {
            visited.add(neighbour)
            pending.push(neighbour)
          }
        }
      }
    }
    regions.push(getRegion(input, differing, members, columns))
  })
  return regions
    .sort((first, second) => second.differingCount - first.differingCount)
    .slice(0, input.maximumRegionCount)
}

// Compares the original's rasterised frame with the port's pixels: the share of pixels whose colour differs by more than
// the tolerance, where they cluster (bounding boxes with the original textures under them), and per original texture how
// many of its pixels differ.
export const comparePixels = (input: PixelComparisonInput): PixelComparison => {
  const differing = getDifferingPixels(input)
  const differingCount = differing.reduce((total, isDifferent) => total + isDifferent, 0)
  return Object.freeze({
    pixelCount: differing.length,
    differingCount,
    differingShare: differingCount / differing.length,
    regions: getRegions(input, differing),
    textureCoverages: getTextureCoverages(input, differing),
  })
}
