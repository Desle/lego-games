import type { SceneBitmap, SceneMesh } from '@lego-games/lego-racers/scene'
import { getColorShares } from './model-surface.ts'
import { WheelKind } from './ldraw-wheel-sets.types.ts'
import type { WheelShape } from './wheel-analysis.types.ts'

const MINIMUM_HUB_BRIGHTNESS = 60
const END_CAP_FRACTION = 0.8
const FLAT_FACE_FRACTION = 0.02
const RGBA_STRIDE = 4

// What each material of the chassis wheel models is, read from the models and their pictures (the wooden wagon wheel; the small
// hex slick with a four-spoke hub; the knobbly tyre; the knobbly tyre on a twelve-spoke hub; the ribbed drums that two wheels fuse into).
const WHEEL_KIND_BY_MATERIAL: ReadonlyMap<string, WheelKind> = new Map([
  ['wgnwhl', WheelKind.WOODEN_SPOKED],
  ['mate2144', WheelKind.SLICK],
  ['mate2628', WheelKind.OFFROAD],
  ['bb_tire', WheelKind.OFFROAD],
  ['advn_tr1', WheelKind.SPOKED_OFFROAD],
  ['bvb_1647', WheelKind.SPOKED_OFFROAD],
  ['ad_car', WheelKind.DRUM],
  ['gmtires', WheelKind.DRUM],
])

export const getWheelKind = (materialName: string): WheelKind =>
  WHEEL_KIND_BY_MATERIAL.get(materialName) ?? WheelKind.DRUM

const getCoordinate = (mesh: SceneMesh, vertex: number, axis: number): number =>
  mesh.positions[vertex * 3 + axis] ?? 0

// The picture's colour at a point of its texture coordinates (v counts up from the bottom row).
const getPictureColor = (bitmap: SceneBitmap, u: number, v: number): readonly number[] => {
  const column = Math.min(bitmap.width - 1, Math.floor((u - Math.floor(u)) * bitmap.width))
  const row = Math.min(bitmap.height - 1, Math.floor((1 - (v - Math.floor(v))) * bitmap.height))
  const base = (row * bitmap.width + column) * RGBA_STRIDE
  return [0, 1, 2, 3].map((channel) => bitmap.colors[base + channel] ?? 0)
}

// A face of the wheel's end cap: flat, across the axle, at one end of the wheel.
const getIsHubFace = (mesh: SceneMesh, corners: readonly number[], wheel: WheelShape): boolean => {
  const axials = corners.map((vertex) => getCoordinate(mesh, vertex, wheel.axisIndex))
  const isFlat = Math.max(...axials) - Math.min(...axials) <= wheel.radius * FLAT_FACE_FRACTION
  const offset = Math.abs((axials[0] ?? 0) - (wheel.centre[wheel.axisIndex] ?? 0))
  return isFlat && offset >= (wheel.width / 2) * END_CAP_FRACTION && offset <= wheel.width / 2 + 1
}

const getTextureCoordinate = (mesh: SceneMesh, vertex: number, offset: number): number =>
  mesh.textureCoordinates[vertex * 2 + offset] ?? 0

// The middle of a face's texture coordinates and the points halfway to each corner.
const getFaceSamplePoints = (
  mesh: SceneMesh,
  corners: readonly number[]
): readonly (readonly number[])[] => {
  const middle = [0, 1].map(
    (offset) =>
      corners.reduce((sum, vertex) => sum + getTextureCoordinate(mesh, vertex, offset), 0) /
      corners.length
  )
  const halfway = corners.map((vertex) =>
    middle.map((value, offset) => (value + getTextureCoordinate(mesh, vertex, offset)) / 2)
  )
  return [middle, ...halfway]
}

// The colour the original paints a wheel's hub (0xRRGGBB): the most common bright colour of the picture under the wheel's flat faces
// near its axle (a car's picture is shared with its body, so the picture as a whole says nothing). Null when no face shows one.
export const getHubColor = (
  mesh: SceneMesh,
  bitmap: SceneBitmap,
  wheel: WheelShape
): number | null => {
  const samples: number[] = []
  for (const { vertexIndices } of mesh.drawBatches) {
    for (let start = 0; start + 2 < vertexIndices.length; start += 3) {
      const corners = [0, 1, 2].map((offset) => vertexIndices[start + offset] ?? 0)
      if (!getIsHubFace(mesh, corners, wheel)) continue
      for (const [u = 0, v = 0] of getFaceSamplePoints(mesh, corners))
        samples.push(...getPictureColor(bitmap, u, v))
    }
  }
  if (samples.length === 0) return null
  const sampleBitmap: SceneBitmap = {
    width: samples.length / RGBA_STRIDE,
    height: 1,
    colors: Uint8Array.from(samples),
  }
  return (
    getColorShares(sampleBitmap).find(
      ({ color }) =>
        Math.max(color >> 16, (color >> 8) & 0xff, color & 0xff) >= MINIMUM_HUB_BRIGHTNESS
    )?.color ?? null
  )
}
