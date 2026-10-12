import { createContext, useContext } from 'react'
import { useTrackViewerController } from '../../controller/track-viewer-controller/track-viewer-controller.ts'
import type { TrackViewerController } from '../../controller/track-viewer-controller/track-viewer-controller.types.ts'
import type { TrackViewerProviderProps } from './track-viewer-provider.types.ts'

const TrackViewerContext = createContext<TrackViewerController | null>(null)

export const TrackViewerProvider = ({ children }: TrackViewerProviderProps) => (
  <TrackViewerContext value={useTrackViewerController()}>{children}</TrackViewerContext>
)

export const useTrackViewer = (): TrackViewerController => {
  const controller = useContext(TrackViewerContext)
  if (controller === null) throw new Error('useTrackViewer needs a TrackViewerProvider above it')
  return controller
}
