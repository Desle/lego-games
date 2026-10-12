import type { SceneTexture } from '@lego-games/lego-racers/scene'

export type TextureReferences = {
  // The URI, relative to the glTF file, of the exported PNG of a scene texture; null when the picture is missing.
  readonly getTextureUri: (modelFile: string, texture: SceneTexture) => string | null
}

export type TextureUriResolver = (texture: SceneTexture) => string | null
