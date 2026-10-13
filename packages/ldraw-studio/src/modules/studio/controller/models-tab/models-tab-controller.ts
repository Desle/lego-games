import { createModelViewer, describeLDrawModel } from '@lego-games/ldraw/editor'
import type { LookPreset } from '@lego-games/ldraw/material'
import { collectModelText, groupModelFiles } from '../../services/model-files/model-files.ts'
import { getModelFiles, getModelText } from '../../services/studio-files/studio-files.ts'
import { STUDIO_LIBRARY_URL } from '../../services/studio-routes/studio-routes.constants.ts'
import type { ModelFile } from '../../types/studio.types.ts'
import type { ModelsTabController, ModelsTabStart, ModelsTabView } from './models-tab.types.ts'

// The list is read again this often, so a model saved by another tool shows without a reload.
const POLL_MILLISECONDS = 1500

const getIsSameList = (first: readonly ModelFile[], second: readonly ModelFile[]): boolean =>
  first.length === second.length && first.every((file, index) => file.path === second[index]?.path)

// Picks model files from the dev server's models folder and shows each, with the models it places, in the editor's viewer in `element`.
export const createModelsTabController = (
  element: HTMLElement,
  view: ModelsTabView,
  initial: ModelsTabStart
): ModelsTabController => {
  const viewer = createModelViewer(element, { libraryUrl: STUDIO_LIBRARY_URL, look: initial.look })
  let files: readonly ModelFile[] = []
  let selectedPath = initial.path
  let shown: ModelFile | null = null
  let loadCounter = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let isDisposed = false

  const getSelectedFile = (): ModelFile | null =>
    files.find((file) => file.path === selectedPath) ?? files[0] ?? null

  const showFile = async (file: ModelFile) => {
    loadCounter += 1
    const counter = loadCounter
    const isCameraKept = shown?.path === file.path
    shown = file
    const showCurrentStatus = (text: string) => {
      if (counter === loadCounter) view.showStatus(text)
    }
    showCurrentStatus(`Loading ${file.path}...`)
    try {
      const text = await collectModelText(file.path, files, getModelText)
      if (text === null) {
        showCurrentStatus(`Could not read ${file.path}`)
        return
      }
      await viewer.showModel(text, { isCameraKept })
      const description = describeLDrawModel(text)
      showCurrentStatus(
        [`${file.path}: ${String(description.partCount)} parts`, ...description.headerLines].join(
          '\n'
        )
      )
    } catch (error: unknown) {
      showCurrentStatus(`Could not draw ${file.path}: ${String(error)}`)
    }
  }

  const getIsChanged = (file: ModelFile): boolean =>
    shown?.path !== file.path || shown.modifiedMilliseconds !== file.modifiedMilliseconds

  const poll = async () => {
    try {
      const latest = await getModelFiles()
      const isListChanged = !getIsSameList(files, latest)
      files = latest
      if (isListChanged) view.showFolders(groupModelFiles(files), getSelectedFile()?.path ?? null)
      const selected = getSelectedFile()
      if (selected !== null && getIsChanged(selected)) await showFile(selected)
    } catch {
      view.showStatus('The models route is not available (the studio dev server only).')
    }
    if (!isDisposed) timer = setTimeout(() => void poll(), POLL_MILLISECONDS)
  }

  const selectModel = (path: string) => {
    selectedPath = path
    history.replaceState(null, '', `#${encodeURIComponent(path)}`)
    const selected = getSelectedFile()
    if (selected !== null) void showFile(selected)
  }

  const setLook = (preset: LookPreset) => void viewer.setLook(preset)

  const dispose = () => {
    isDisposed = true
    clearTimeout(timer)
    viewer.dispose()
  }

  void poll()
  return Object.freeze({ selectModel, setLook, dispose })
}
