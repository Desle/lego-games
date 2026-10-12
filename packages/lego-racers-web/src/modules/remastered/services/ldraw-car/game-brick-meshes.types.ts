// How the game's brick faces are coloured: each colour's material of the brick material library, and for every material the
// brick colour it stands for (-1 for a decal or other material that is no colour).
export type GameBrickMaterials = {
  readonly colorMaterialIndices: readonly number[]
  readonly fixedMaterialColors: readonly number[]
}
