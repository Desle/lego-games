export type DevelopmentPanelProps = {
  readonly isRaceRunning: boolean
  readonly onTrackViewerOpened: () => void
  readonly onRaceStopped: () => void
  readonly onRecordingDownloaded: () => void
  readonly onEverythingUnlocked: () => void
  // The upscaled texture packs the dev server offers, and the one in use (null: the original textures).
  readonly textureVariants: readonly string[]
  readonly selectedTextureVariant: string | null
  readonly onTextureVariantSelected: (variant: string | null) => void
  readonly onOverlayClosed: () => void
}
