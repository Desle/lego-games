import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { Scene } from '@lego-games/lego-racers/scene'
import type { SceneSummary, ViewerStatus, WorldGroup } from '../../types/track-viewer.types.ts'

export type TrackViewerState = {
  readonly status: ViewerStatus
  readonly archive: JamArchive | null
  readonly worldGroups: readonly WorldGroup[]
  readonly selectedEntryId: string | null
  readonly scene: Scene | null
  readonly sceneSummary: SceneSummary | null
  // The world camera the view starts from; null frames the whole scene.
  readonly selectedCameraIndex: number | null
  readonly errorMessage: string | null
}

export type TrackViewerController = TrackViewerState & {
  readonly isDevelopmentJamAvailable: boolean
  readonly onJamFileChosen: (file: Blob) => void
  readonly onDevelopmentJamRequested: () => void
  readonly onWorldEntrySelected: (entryId: string) => void
  readonly onCameraSelected: (cameraIndex: number | null) => void
}
