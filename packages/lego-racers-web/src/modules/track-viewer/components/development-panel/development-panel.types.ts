export type DevelopmentPanelProps = {
  readonly isRaceRunning: boolean
  readonly onTrackViewerOpened: () => void
  readonly onRaceStopped: () => void
  readonly onOverlayClosed: () => void
}
