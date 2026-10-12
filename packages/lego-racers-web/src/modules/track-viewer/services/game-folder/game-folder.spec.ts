import { getNeededGameFiles, pickGameFolderFiles } from './game-folder.ts'
import type { GameFolderEntryHandle } from './game-folder.types.ts'

const fileHandle = (name: string): GameFolderEntryHandle => ({
  kind: 'file',
  name,
  getFile: () => Promise.resolve(new File(['x'], name)),
})

const directoryHandle = (
  name: string,
  entries: readonly GameFolderEntryHandle[]
): GameFolderEntryHandle => ({
  kind: 'directory',
  name,
  values: () => ({
    [Symbol.asyncIterator]: () => {
      const remaining = [...entries]
      return {
        next: () =>
          Promise.resolve({
            done: remaining.length === 0,
            value: remaining.shift() as GameFolderEntryHandle,
          }),
      }
    },
  }),
})

describe('game folder', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'showDirectoryPicker')
  })

  it('keeps only the game files of a folder listing', () => {
    // Arrange
    const files = ['LEGO.JAM', 'legoracers.exe', 'RACE.TUN', 'readme.txt'].map(
      (name) => new File(['x'], name)
    )

    // Act
    const names = getNeededGameFiles(files).map((file) => file.name)

    // Assert
    expect(names).toEqual(['LEGO.JAM', 'legoracers.exe', 'RACE.TUN'])
  })

  it('finds the game files in a nested folder', async () => {
    // Arrange
    const root = directoryHandle('LEGO Racers', [
      fileHandle('notes.txt'),
      directoryHandle('Game Files', [fileHandle('LEGO.JAM'), fileHandle('LEGORacers.exe')]),
    ])
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve(root),
    })

    // Act
    const files = await pickGameFolderFiles()

    // Assert
    expect(files?.map((file) => file.name)).toEqual(['LEGO.JAM', 'LEGORacers.exe'])
  })

  it('returns null when the player cancels', async () => {
    // Arrange
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.reject(new DOMException('cancelled', 'AbortError')),
    })

    // Act
    const files = await pickGameFolderFiles()

    // Assert
    expect(files).toBeNull()
  })
})
