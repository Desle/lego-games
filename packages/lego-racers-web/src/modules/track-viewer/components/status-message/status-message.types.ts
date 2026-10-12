import type { ViewerStatus } from '../../types/track-viewer.types.ts'

export type StatusMessageProps = {
  readonly status: ViewerStatus
  readonly errorMessage: string | null
}
