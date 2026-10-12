export type DevelopmentOverlayController = {
  readonly isOverlayOpen: boolean
  readonly isTrackViewerOpen: boolean
  readonly onTrackViewerOpened: () => void
  readonly onTrackViewerClosed: () => void
  readonly onRecordingDownloaded: () => void
  readonly onEverythingUnlocked: () => void
  readonly onOverlayClosed: () => void
}
