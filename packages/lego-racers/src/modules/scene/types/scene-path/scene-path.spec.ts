import { ScenePathError } from '../scene-errors/scene-errors.ts'
import {
  getArchivePath,
  getDirectory,
  getNameWithDefaultExtension,
  getNameWithImageExtension,
} from './scene-path.ts'

describe('scene paths', () => {
  it('replaces an extension with the reader default and appends it to a bare name', () => {
    // Arrange
    const listedName = 'rrtrk.tdf'

    // Act
    const replaced = getNameWithDefaultExtension(listedName, '.tdb')
    const appended = getNameWithDefaultExtension('rrtrk', '.tdb')

    // Assert
    expect(replaced).toBe('rrtrk.tdb')
    expect(appended).toBe('rrtrk.tdb')
  })

  it('appends an image extension unless the name already ends with it', () => {
    // Arrange
    const name = 'grass'

    // Act
    const appended = getNameWithImageExtension(name, '.bmp')
    const kept = getNameWithImageExtension('grass.bmp', '.bmp')

    // Assert
    expect(appended).toBe('grass.bmp')
    expect(kept).toBe('grass.bmp')
  })

  it('joins a relative name to the current directory and uppercases the path', () => {
    // Arrange
    const directory = 'GAMEDATA\\RACEC0R0'

    // Act
    const joined = getArchivePath(directory, 'rrtrk.tdb')
    const rooted = getArchivePath(directory, '\\gamedata\\common\\global.wdb')

    // Assert
    expect(joined).toBe('GAMEDATA\\RACEC0R0\\RRTRK.TDB')
    expect(rooted).toBe('GAMEDATA\\COMMON\\GLOBAL.WDB')
  })

  it('refuses names longer than the 255-character path buffer', () => {
    // Arrange
    const name = 'a'.repeat(256)

    // Act
    const build = () => getArchivePath('GAMEDATA', name)

    // Assert
    expect(build).toThrow(ScenePathError)
  })

  it('takes the directory of a path', () => {
    // Arrange
    const path = 'GAMEDATA\\RACEC0R0\\RRTRK.WDB'

    // Act
    const directory = getDirectory(path)

    // Assert
    expect(directory).toBe('GAMEDATA\\RACEC0R0')
    expect(getDirectory('ROOT.WDB')).toBe('')
  })
})
