export type DevelopmentOverlayController = {
  readonly isOverlayOpen: boolean
  readonly isTrackViewerOpen: boolean
  readonly onTrackViewerOpened: () => void
  readonly onTrackViewerClosed: () => void
  readonly onRecordingDownloaded: () => void
  readonly onEverythingUnlocked: () => void
  readonly textureVariants: readonly string[]
  readonly selectedTextureVariant: string | null
  readonly onTextureVariantSelected: (variant: string | null) => void
  readonly onOverlayClosed: () => void
}
