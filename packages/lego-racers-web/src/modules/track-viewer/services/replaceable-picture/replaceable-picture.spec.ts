import {
  clearViewerExtensions,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { createReplaceablePicture } from './replaceable-picture.ts'

const ORIGINAL = { name: 'exit', width: 2, height: 1, colors: new Uint8Array(8) }

describe('createReplaceablePicture', () => {
  afterEach(() => clearViewerExtensions())

  it('stays the original without an extension', () => {
    // Arrange
    const onReplaced = vi.fn()

    // Act
    const picture = createReplaceablePicture('MENUDATA\\EXIT.BMP', ORIGINAL, onReplaced)

    // Assert
    expect([picture.getState().sourceScale, onReplaced.mock.calls.length]).toEqual([1, 0])
  })

  it('takes a bigger picture from an extension and reports its scale', () => {
    // Arrange
    registerViewerExtension({
      ...NEUTRAL_EXTENSION,
      onPictureCreated: (event) =>
        event.replacePixels({ colors: new Uint8Array(32), width: 8, height: 1 }),
    })
    const onReplaced = vi.fn()

    // Act
    const picture = createReplaceablePicture('MENUDATA\\EXIT.BMP', ORIGINAL, onReplaced)

    // Assert
    expect([
      picture.getState().sourceScale,
      picture.getState().width,
      onReplaced.mock.calls.length,
    ]).toEqual([4, 8, 1])
  })
})
