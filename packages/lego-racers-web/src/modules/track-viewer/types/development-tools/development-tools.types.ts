import type { DevelopmentSelector } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'

// What the developer panel offers, shared by the overlay controller and the panel it renders.
export type DevelopmentToolActions = {
  readonly onTrackViewerOpened: () => void
  readonly onRecordingDownloaded: () => void
  readonly onEverythingUnlocked: () => void
  // The choices a layer above the original port adds (its textures, for one).
  readonly selectors: readonly DevelopmentSelector[]
  readonly onOverlayClosed: () => void
}
