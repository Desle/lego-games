import type { DevelopmentToolActions } from '../../types/development-tools/development-tools.types.ts'

export type DevelopmentOverlayController = DevelopmentToolActions & {
  readonly isOverlayOpen: boolean
  readonly isTrackViewerOpen: boolean
  readonly onTrackViewerClosed: () => void
}
