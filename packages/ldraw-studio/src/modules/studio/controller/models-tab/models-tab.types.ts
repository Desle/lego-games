import type { LookPreset } from '@lego-games/ldraw/material'
import type { ModelFolder } from '../../types/studio.types.ts'

// What the Models tab's page shows: the picker's folders with the selected file, and a status (loading, the part count, a problem).
export type ModelsTabView = {
  readonly showFolders: (folders: readonly ModelFolder[], selectedPath: string | null) => void
  readonly showStatus: (text: string) => void
}

export type ModelsTabController = {
  readonly selectModel: (path: string) => void
  readonly setLook: (preset: LookPreset) => void
  readonly dispose: () => void
}

// The file the address names (`#<path>`; the first file when null) and the look it asks for.
export type ModelsTabStart = {
  readonly path: string | null
  readonly look: LookPreset
}
