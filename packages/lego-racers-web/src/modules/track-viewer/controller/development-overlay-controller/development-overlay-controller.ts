import { useEffect, useState, useSyncExternalStore } from 'react'
import { downloadLastRecording } from '../../services/recording-download/recording-download.ts'
import { developmentToolsState } from '../../services/development-tools-state/development-tools-state.ts'
import type { DevelopmentOverlayController } from './development-overlay-controller.types.ts'

const TOGGLE_KEY_CODE = 'Backquote'
const DOWNLOAD_RECORDING_KEY_CODE = 'F9'

// F9 downloads the last session recording. The backquote key opens and closes the developer overlay; the development keys listen only while it is open.
export const useDevelopmentOverlayController = (): DevelopmentOverlayController => {
  const isOverlayOpen = useSyncExternalStore(
    developmentToolsState.subscribe,
    developmentToolsState.getIsOpen
  )
  const [isTrackViewerOpen, setIsTrackViewerOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === DOWNLOAD_RECORDING_KEY_CODE) void downloadLastRecording()
      if (event.code === TOGGLE_KEY_CODE)
        developmentToolsState.setIsOpen(!developmentToolsState.getIsOpen())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return {
    isOverlayOpen,
    isTrackViewerOpen,
    onTrackViewerOpened: () => setIsTrackViewerOpen(true),
    onTrackViewerClosed: () => setIsTrackViewerOpen(false),
    onRecordingDownloaded: () => void downloadLastRecording(),
    onOverlayClosed: () => developmentToolsState.setIsOpen(false),
  }
}
