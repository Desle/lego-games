import { useEffect, useState, useSyncExternalStore } from 'react'
import { downloadLastRecording } from '../../services/recording-download/recording-download.ts'
import { createIndexedDbSaveStorage } from '../../services/indexed-db-save-storage/indexed-db-save-storage.ts'
import { unlockEverythingInStorage } from '../../services/development-unlocks/development-unlocks.ts'
import {
  getHighDefinitionVariant,
  getIsHighDefinitionEnabled,
  getPageSearch,
} from '../../services/scene-object/high-definition-texture/high-definition-texture.ts'
import { getTextureVariants } from '../../services/texture-variants/texture-variants.ts'
import { developmentToolsState } from '../../services/development-tools-state/development-tools-state.ts'
import type { DevelopmentOverlayController } from './development-overlay-controller.types.ts'

const TOGGLE_KEY_CODE = 'Backquote'
const DOWNLOAD_RECORDING_KEY_CODE = 'F9'

// F9 downloads the last session recording. The backquote key opens and closes the developer overlay; the development keys listen only while it is open.
// The game reads its save when it opens, so the page reloads to pick up the unlocked one.
const unlockEverything = async () => {
  const isUnlocked = await unlockEverythingInStorage(createIndexedDbSaveStorage()).catch(
    () => false
  )
  if (isUnlocked) globalThis.location.reload()
}

// Switching packs reloads the page: textures are swapped as they load.
const selectTextureVariant = (variant: string | null) => {
  const url = new URL(globalThis.location.href)
  if (variant === null) url.searchParams.delete('hd')
  else url.searchParams.set('hd', variant)
  globalThis.location.assign(url.toString())
}

const getSelectedTextureVariant = (): string | null => {
  const search = getPageSearch()
  return getIsHighDefinitionEnabled(search) ? getHighDefinitionVariant(search) : null
}

export const useDevelopmentOverlayController = (): DevelopmentOverlayController => {
  const isOverlayOpen = useSyncExternalStore(
    developmentToolsState.subscribe,
    developmentToolsState.getIsOpen
  )
  const [isTrackViewerOpen, setIsTrackViewerOpen] = useState(false)
  const [textureVariants, setTextureVariants] = useState<readonly string[]>([])

  useEffect(() => {
    if (!isOverlayOpen) return
    void getTextureVariants().then(setTextureVariants)
  }, [isOverlayOpen])

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
    onEverythingUnlocked: () => void unlockEverything(),
    textureVariants,
    selectedTextureVariant: getSelectedTextureVariant(),
    onTextureVariantSelected: (variant) => selectTextureVariant(variant),
    onOverlayClosed: () => developmentToolsState.setIsOpen(false),
  }
}
