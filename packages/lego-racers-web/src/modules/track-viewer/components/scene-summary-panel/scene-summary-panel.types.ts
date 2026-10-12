import type { SceneSummary } from '../../types/track-viewer.types.ts'

export type SceneSummaryPanelProps = {
  readonly summary: SceneSummary
  readonly selectedCameraIndex: number | null
  readonly onCameraSelected: (cameraIndex: number | null) => void
}
