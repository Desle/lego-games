import type { JamArchive } from '../../../jam-archive/index.ts'
import type { SceneMaterial, SceneTexture } from '../../types/scene.types.ts'

// The archive and the directory the game made current before loading the world (archive +0x1c).
export type SceneFileSource = {
  readonly archive: JamArchive
  readonly directory: string
}

export type LinkedTextures = {
  readonly textures: readonly SceneTexture[]
  // Registered names (first eight characters) → index; a later database never re-registers a name.
  readonly indexByName: ReadonlyMap<string, number>
}

export type LinkedMaterials = {
  readonly materials: readonly SceneMaterial[]
  // The world's material chain searched newest library first (0x10028c20 over the list 0x10028bc0 prepends to).
  readonly indexByName: ReadonlyMap<string, number>
}
