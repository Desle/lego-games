export type JamFilePickerProps = {
  readonly isBusy: boolean
  readonly isDevelopmentJamAvailable: boolean
  readonly onJamFileChosen: (file: Blob) => void
  readonly onDevelopmentJamRequested: () => void
}
