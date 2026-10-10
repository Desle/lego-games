import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadScene } from '@lego-games/lego-racers/scene'
import { useCallback, useState } from 'react'
import { getDevelopmentJam, readJamFile } from '../../services/jam-file/jam-file.ts'
import { getSceneSummary, getWorldGroups } from '../../services/world-catalog/world-catalog.ts'
import { ViewerStatus } from '../../types/viewer-status/viewer-status.ts'
import type { TrackViewerController, TrackViewerState } from './track-viewer-controller.types.ts'

const INITIAL_STATE: TrackViewerState = Object.freeze({
  status: ViewerStatus.WAITING_FOR_ARCHIVE,
  archive: null,
  worldGroups: [],
  selectedEntryId: null,
  scene: null,
  sceneSummary: null,
  selectedCameraIndex: null,
  errorMessage: null,
})

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// Opens the archive, lists its worlds, and loads the chosen one into a scene.
export const useTrackViewerController = (): TrackViewerController => {
  const [state, setState] = useState<TrackViewerState>(INITIAL_STATE)

  const openArchive = useCallback(async (readBytes: () => Promise<Uint8Array>) => {
    setState({ ...INITIAL_STATE, status: ViewerStatus.READING_ARCHIVE })
    try {
      const archive = openJamArchive(await readBytes())
      setState({
        ...INITIAL_STATE,
        status: ViewerStatus.CHOOSING_WORLD,
        archive,
        worldGroups: getWorldGroups(archive),
      })
    } catch (error) {
      setState({
        ...INITIAL_STATE,
        status: ViewerStatus.FAILED,
        errorMessage: getErrorMessage(error),
      })
    }
  }, [])

  const selectWorldEntry = useCallback(
    (entryId: string) => {
      const entry = state.worldGroups
        .flatMap((group) => group.entries)
        .find((candidate) => candidate.id === entryId)
      if (state.archive === null || entry === undefined) return
      const { archive } = state
      setState((previous) => ({
        ...previous,
        status: ViewerStatus.LOADING_SCENE,
        selectedEntryId: entryId,
      }))
      // Lets the loading state paint before the synchronous load.
      window.setTimeout(() => {
        try {
          const scene = loadScene(archive, entry.worldPaths)
          setState((previous) => ({
            ...previous,
            status: ViewerStatus.SHOWING_SCENE,
            scene,
            sceneSummary: getSceneSummary(scene),
            selectedCameraIndex: scene.cameras.length > 0 ? 0 : null,
            errorMessage: null,
          }))
        } catch (error) {
          setState((previous) => ({
            ...previous,
            status: ViewerStatus.FAILED,
            scene: null,
            sceneSummary: null,
            errorMessage: getErrorMessage(error),
          }))
        }
      }, 0)
    },
    [state]
  )

  return {
    ...state,
    isDevelopmentJamAvailable: import.meta.env.DEV,
    onJamFileChosen: (file) => void openArchive(() => readJamFile(file)),
    // A production build replaces DEV with false and drops the development fetch entirely.
    onDevelopmentJamRequested: import.meta.env.DEV
      ? () => void openArchive(getDevelopmentJam)
      : () => undefined,
    onWorldEntrySelected: (entryId) => selectWorldEntry(entryId),
    onCameraSelected: (cameraIndex) =>
      setState((previous) => ({ ...previous, selectedCameraIndex: cameraIndex })),
  }
}
