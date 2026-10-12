import type { ModelScene, SceneBitmap } from '@lego-games/lego-racers/scene'
import type { BatchSurface, BitmapRegion, ColorBin, ColorShare } from './model-surface.types.ts'

const COLOR_CHANNELS = 3
const RGBA_STRIDE = 4
const MINIMUM_OPAQUE_ALPHA = 128
const QUANTIZATION_SHIFT = 3

// The materials of a model's first instance by draw batch: the material name and, when the material has a picture, its bitmap.
export const getBatchSurfaces = (model: ModelScene): readonly BatchSurface[] => {
  const { scene } = model
  const level = scene.instances[0]?.levels[0]
  const mesh = scene.meshes[level?.meshIndex ?? -1]
  if (level === undefined || mesh === undefined) return []
  const assignment =
    level.materialAssignmentIndex === null
      ? null
      : scene.materialAssignments[level.materialAssignmentIndex]
  return mesh.drawBatches.map((batch): BatchSurface => {
    const materialIndex = (assignment?.materialIndices ?? mesh.materialIndices)[batch.materialSlot]
    const material = materialIndex === undefined ? undefined : scene.materials[materialIndex]
    const texture = scene.textures[material?.textureIndex ?? -1]
    return Object.freeze({
      materialName: material?.name ?? '',
      bitmapPath: texture?.bitmapPath ?? '',
      bitmap: texture?.bitmap ?? null,
      diffuseColor: material?.diffuseColor ?? [255, 255, 255, 255],
    })
  })
}

const getPixelChannels = (bitmap: SceneBitmap, pixel: number): readonly number[] =>
  [0, 1, 2].map((channel) => bitmap.colors[pixel * RGBA_STRIDE + channel] ?? 0)

const getIsOpaque = (bitmap: SceneBitmap, pixel: number): boolean =>
  (bitmap.colors[pixel * RGBA_STRIDE + COLOR_CHANNELS] ?? 0) >= MINIMUM_OPAQUE_ALPHA

const packColor = ([red = 0, green = 0, blue = 0]: readonly number[]): number =>
  (red << 16) | (green << 8) | blue

// The average colour of the opaque pixels of a bitmap (of a part of it) that are not darker than the threshold, as 0xRRGGBB; null when
// there are none.
export const getAverageColor = (
  bitmap: SceneBitmap,
  minimumBrightness = 0,
  region: BitmapRegion | null = null
): number | null => {
  const left = Math.floor((region?.left ?? 0) * bitmap.width)
  const right = Math.max(left + 1, Math.ceil((region?.right ?? 1) * bitmap.width))
  const top = Math.floor((region?.top ?? 0) * bitmap.height)
  const bottom = Math.max(top + 1, Math.ceil((region?.bottom ?? 1) * bitmap.height))
  const sums = [0, 0, 0]
  let count = 0
  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      const pixel = row * bitmap.width + column
      if (!getIsOpaque(bitmap, pixel)) continue
      const channels = getPixelChannels(bitmap, pixel)
      if (Math.max(...channels) < minimumBrightness) continue
      for (const [channel, value] of channels.entries())
        sums[channel] = (sums[channel] ?? 0) + value
      count += 1
    }
  }
  return count === 0 ? null : packColor(sums.map((sum) => Math.round(sum / count)))
}

// The colours of a bitmap's opaque pixels, grouped by the top five bits of each channel, most common first.
export const getColorShares = (bitmap: SceneBitmap): readonly ColorShare[] => {
  const bins = new Map<number, ColorBin>()
  let total = 0
  for (let pixel = 0; pixel < bitmap.width * bitmap.height; pixel += 1) {
    if (!getIsOpaque(bitmap, pixel)) continue
    const channels = getPixelChannels(bitmap, pixel)
    const key = packColor(channels.map((value) => value >> QUANTIZATION_SHIFT))
    const bin = bins.get(key) ?? { count: 0, sums: [0, 0, 0] }
    bin.count += 1
    for (const [channel, value] of channels.entries())
      bin.sums[channel] = (bin.sums[channel] ?? 0) + value
    bins.set(key, bin)
    total += 1
  }
  return [...bins.values()]
    .sort((first, second) => second.count - first.count)
    .map((bin) => ({
      color: packColor(bin.sums.map((sum) => Math.round(sum / bin.count))),
      share: bin.count / total,
    }))
}

// The colour that covers most of a part of a bitmap's opaque pixels (the average of its quantization bin), null when there are none.
export const getDominantColor = (
  bitmap: SceneBitmap,
  region: BitmapRegion | null = null
): number | null => {
  const left = Math.floor((region?.left ?? 0) * bitmap.width)
  const right = Math.max(left + 1, Math.ceil((region?.right ?? 1) * bitmap.width))
  const top = Math.floor((region?.top ?? 0) * bitmap.height)
  const bottom = Math.max(top + 1, Math.ceil((region?.bottom ?? 1) * bitmap.height))
  const part: SceneBitmap = {
    width: right - left,
    height: bottom - top,
    colors: Uint8Array.from(
      Array.from({ length: (right - left) * (bottom - top) * RGBA_STRIDE }, (_unused, index) => {
        const pixel = Math.floor(index / RGBA_STRIDE)
        const column = left + (pixel % (right - left))
        const row = top + Math.floor(pixel / (right - left))
        return bitmap.colors[(row * bitmap.width + column) * RGBA_STRIDE + (index % RGBA_STRIDE)] ?? 0
      })
    ),
  }
  return getColorShares(part)[0]?.color ?? null
}

// The most common colour of a bitmap's opaque pixels that is not darker than the threshold (a hub on a dark tyre), null when there is none.
export const getDominantBrightColor = (bitmap: SceneBitmap, minimumBrightness: number): number | null =>
  getColorShares(bitmap).find(
    ({ color }) => Math.max(color >> 16, (color >> 8) & 0xff, color & 0xff) >= minimumBrightness
  )?.color ?? null
