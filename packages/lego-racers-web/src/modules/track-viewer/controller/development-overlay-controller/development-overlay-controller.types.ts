export type DevelopmentOverlayController = {
  readonly isOverlayOpen: boolean
  readonly isTrackViewerOpen: boolean
  readonly onTrackViewerOpened: () => void
  readonly onTrackViewerClosed: () => void
  readonly onOverlayClosed: () => void
}
