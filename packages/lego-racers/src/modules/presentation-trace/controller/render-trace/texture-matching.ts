import { getChannel } from '../pixel-trace/decode-texture.ts'
import type { OriginalTexture } from '../../types/presentation-trace.types.ts'
import type { PortTexture, Rgb, TextureDifference } from './render-trace.types.ts'
import type { TextureMatch } from './texture-matching.types.ts'

const GRID_SIZE = 16
const BYTES_PER_COLOR = 4
// Colours reach the surface in 5 or 6 bits per channel, so identical pictures differ by up to this much.
const QUANTISATION_LEVELS = 6
// A picture further than this from every port texture has no counterpart.
const MAXIMUM_DIFFERENCE = 32

const getOriginalColor = (texture: OriginalTexture, x: number, y: number): Rgb => {
  const bytesPerPixel = texture.bitsPerPixel / 8
  const offset = y * texture.pitch + x * bytesPerPixel
  let value = 0
  for (let byte = 0; byte < bytesPerPixel; byte++) {
    value += (texture.pixels[offset + byte] ?? 0) * 2 ** (8 * byte)
  }
  const [redMask = 0, greenMask = 0, blueMask = 0] = texture.masks
  return [getChannel(value, redMask), getChannel(value, greenMask), getChannel(value, blueMask)]
}

const getPortColor = (texture: PortTexture, x: number, y: number): Rgb => {
  const offset = (y * texture.width + x) * BYTES_PER_COLOR
  return [
    texture.colors[offset] ?? 0,
    texture.colors[offset + 1] ?? 0,
    texture.colors[offset + 2] ?? 0,
  ]
}

const getSamplePosition = (cell: number, size: number): number =>
  Math.min(size - 1, Math.floor(((cell + 0.5) * size) / GRID_SIZE))

const getDifference = (original: OriginalTexture, port: PortTexture): number => {
  let total = 0
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let column = 0; column < GRID_SIZE; column++) {
      const left = getOriginalColor(
        original,
        getSamplePosition(column, original.width),
        getSamplePosition(row, original.height)
      )
      const right = getPortColor(
        port,
        getSamplePosition(column, port.width),
        getSamplePosition(row, port.height)
      )
      total +=
        Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2])
    }
  }
  return total / (GRID_SIZE * GRID_SIZE * 3)
}

// Which port textures look like the original's surface: the closest, and every one within the quantisation of it.
export const matchTexture = (
  original: OriginalTexture,
  portTextures: ReadonlyMap<string, PortTexture>
): TextureMatch => {
  const differences = [...portTextures].map(([key, texture]) => ({
    key,
    difference: getDifference(original, texture),
  }))
  const best = differences.reduce<TextureDifference | null>(
    (current, candidate) =>
      current === null || candidate.difference < current.difference ? candidate : current,
    null
  )
  if (best === null || best.difference > MAXIMUM_DIFFERENCE) {
    return Object.freeze({ bestKey: null, difference: best?.difference ?? 0, acceptableKeys: [] })
  }
  return Object.freeze({
    bestKey: best.key,
    difference: best.difference,
    acceptableKeys: differences
      .filter((candidate) => candidate.difference <= best.difference + QUANTISATION_LEVELS)
      .map((candidate) => candidate.key),
  })
}

// The match of every texture the original used.
export const matchTextures = (
  originals: ReadonlyMap<string, OriginalTexture>,
  portTextures: ReadonlyMap<string, PortTexture>
): ReadonlyMap<string, TextureMatch> =>
  new Map([...originals].map(([hash, texture]) => [hash, matchTexture(texture, portTextures)]))
