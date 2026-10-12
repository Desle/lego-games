export type DevelopmentPanelProps = {
  readonly isRaceRunning: boolean
  readonly onTrackViewerOpened: () => void
  readonly onRaceStopped: () => void
  readonly onRecordingDownloaded: () => void
  readonly onEverythingUnlocked: () => void
  readonly onOverlayClosed: () => void
}
