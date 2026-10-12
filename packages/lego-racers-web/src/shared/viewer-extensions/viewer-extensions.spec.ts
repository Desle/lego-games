import { DataTexture } from 'three'
import {
  clearViewerExtensions,
  emitTextureCreated,
  getIsClassic,
  registerViewerExtension,
} from './viewer-extensions.ts'

describe('viewer extensions', () => {
  afterEach(() => clearViewerExtensions())

  it('is classic until an extension is registered', () => {
    // Arrange
    const isClassicBefore = getIsClassic()

    // Act
    registerViewerExtension({ onTextureCreated: () => undefined, getRaceDisplay: () => null })

    // Assert
    expect([isClassicBefore, getIsClassic()]).toEqual([true, false])
  })

  it('tells every extension about a new texture', () => {
    // Arrange
    const onTextureCreated = vi.fn()
    registerViewerExtension({ onTextureCreated, getRaceDisplay: () => null })
    const event = {
      texture: new DataTexture(new Uint8Array(4), 1, 1),
      bitmapPath: 'A.BMP',
      originalPixels: { colors: new Uint8Array(4), width: 1, height: 1 },
      replacePixels: () => undefined,
    }

    // Act
    emitTextureCreated(event)

    // Assert
    expect(onTextureCreated).toHaveBeenCalledWith(event)
  })
})
