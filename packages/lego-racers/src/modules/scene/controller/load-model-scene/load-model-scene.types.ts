import type { Scene } from '../../types/scene.types.ts'

// The files a loose model needs, each named without its extension and read from one directory: the texture
// databases (`.TDB`), material libraries (`.MDB`) and models (`.GDB`) the way a world's name lists give them.
export type ModelFiles = {
  readonly directory: string
  readonly textureNames: readonly string[]
  readonly materialNames: readonly string[]
  readonly meshNames: readonly string[]
}

// The scene of loose models, one mesh instance per model in `meshNames` order, and each model's scale
// (GDB keyword 0x33, model +0x38).
export type ModelScene = {
  readonly scene: Scene
  readonly meshScales: readonly number[]
}
