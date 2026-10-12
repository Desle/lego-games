import type { DirectoryPickerWindow, GameFolderDirectoryHandle } from './game-folder.types.ts'

const NEEDED_FILE_NAME = /^(LEGO\.JAM|LEGORacers\.exe|.+\.tun)$/i
// The retail install keeps the files in a `Game Files` folder; a folder or two above it is still found.
const MAXIMUM_DEPTH = 3

export const getIsDirectoryPickerAvailable = (): boolean =>
  typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'

// The folder input of the fallback hands over every file under the folder; only the game's own files are kept.
export const getNeededGameFiles = (files: readonly File[]): readonly File[] =>
  files.filter((file) => NEEDED_FILE_NAME.test(file.name))

const collectNeededFiles = async (
  directory: GameFolderDirectoryHandle,
  depth: number
): Promise<readonly File[]> => {
  const found: File[] = []
  for await (const entry of directory.values()) {
    if (entry.kind === 'file') {
      if (NEEDED_FILE_NAME.test(entry.name)) found.push(await entry.getFile())
    } else if (depth < MAXIMUM_DEPTH) {
      found.push(...(await collectNeededFiles(entry, depth + 1)))
    }
  }
  return found
}

// Asks the browser for a folder and reads only the game files in it; null when the player cancels.
export const pickGameFolderFiles = async (): Promise<readonly File[] | null> => {
  const { showDirectoryPicker } = window as DirectoryPickerWindow
  if (showDirectoryPicker === undefined) return null
  try {
    return await collectNeededFiles(await showDirectoryPicker.call(window), 0)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}
