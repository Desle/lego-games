// How the game's brick faces are coloured: each colour's material of the brick material library, and for every material the
// brick colour it stands for (-1 for a decal or other material that is no colour).
import type { SceneBitmap } from '@lego-games/lego-racers/scene'

export type GameBrickMaterials = {
  readonly colorMaterialIndices: readonly number[]
  readonly fixedMaterialColors: readonly number[]
  // The picture of each material of the library (null for a plain colour): the decals of the chassis and the like.
  readonly materialBitmaps: readonly (SceneBitmap | null)[]
}

// The corners of the faces drawn with one material or colour, ready for a buffer geometry.
export type GameFaceBucket = {
  readonly positions: number[]
  readonly normals: number[]
  readonly textureCoordinates: number[]
}
