import { useEffect, useState, useSyncExternalStore } from 'react'
import { developmentToolsState } from '../../services/development-tools-state/development-tools-state.ts'
import type { DevelopmentOverlayController } from './development-overlay-controller.types.ts'

const TOGGLE_KEY_CODE = 'Backquote'

// The backquote key opens and closes the developer overlay; the development keys listen only while it is open.
export const useDevelopmentOverlayController = (): DevelopmentOverlayController => {
  const isOverlayOpen = useSyncExternalStore(
    developmentToolsState.subscribe,
    developmentToolsState.getIsOpen
  )
  const [isTrackViewerOpen, setIsTrackViewerOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== TOGGLE_KEY_CODE || event.repeat) return
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
    onOverlayClosed: () => developmentToolsState.setIsOpen(false),
  }
}
