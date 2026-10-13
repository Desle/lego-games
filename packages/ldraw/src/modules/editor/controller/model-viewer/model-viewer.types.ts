import type { LDrawDetail } from '../../../library/index.ts'
import type { LookPreset } from '../../../material/index.ts'
import type { ModelViewerStats, ShowModelOptions } from '../../types/model-viewer.types.ts'

// `libraryUrl` is where the caller serves the LDraw parts library; a look given here becomes the page's active look.
export type ModelViewerOptions = {
  readonly libraryUrl: string
  readonly look?: LookPreset
  readonly detail?: LDrawDetail
}

export type ModelViewer = {
  readonly showModel: (text: string, options?: ShowModelOptions) => Promise<void>
  readonly setLook: (preset: LookPreset) => Promise<void>
  readonly setDetail: (detail: LDrawDetail) => Promise<void>
  readonly getStats: () => ModelViewerStats
  readonly dispose: () => void
}
