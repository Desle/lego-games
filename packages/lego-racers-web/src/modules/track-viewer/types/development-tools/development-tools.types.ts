// What the developer panel offers, shared by the overlay controller and the panel it renders.
export type DevelopmentToolActions = {
  readonly onTrackViewerOpened: () => void
  readonly onRecordingDownloaded: () => void
  readonly onEverythingUnlocked: () => void
  // The upscaled texture packs the dev server offers, and the one in use (null: the original textures).
  readonly textureVariants: readonly string[]
  readonly selectedTextureVariant: string | null
  readonly onTextureVariantSelected: (variant: string | null) => void
  readonly onOverlayClosed: () => void
}
