import type { ModelScene } from '@lego-games/lego-racers/scene'

// The files of one archive folder that holds GDB models; names are base names without extension.
export type ModelDirectory = {
  readonly directory: string
  readonly modelNames: readonly string[]
  readonly textureNames: readonly string[]
  readonly materialNames: readonly string[]
  // The texture databases and material libraries of the folders above, as absolute archive names.
  readonly ancestorTextureNames: readonly string[]
  readonly ancestorMaterialNames: readonly string[]
  // The archive path of the file with that base name and extension (`.SDB`), or null.
  readonly getPath: (name: string, extension: string) => string | null
}

export type LoadedModel = {
  readonly modelScene: ModelScene
  readonly meshIndex: number
}
