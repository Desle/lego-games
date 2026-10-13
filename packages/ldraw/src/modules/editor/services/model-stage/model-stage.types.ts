import type { Object3D } from 'three'
import type { ModelViewerStats } from '../../types/model-viewer.types.ts'

// The three.js side of a viewer: one canvas, its camera under the pointer, and the one model it shows.
export type ModelStage = {
  readonly setModel: (model: Object3D | null, isFramed: boolean) => void
  readonly draw: () => ModelViewerStats
  readonly dispose: () => void
}
