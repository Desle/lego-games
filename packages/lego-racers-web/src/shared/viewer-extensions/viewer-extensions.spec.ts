import { createBuildGrid } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { DataTexture, Group } from 'three'
import {
  clearViewerExtensions,
  emitTextureCreated,
  getBuiltCarDrawing,
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

  it('draws a built car as the original does until an extension offers a drawing', () => {
    // Arrange
    const request = { archive: {} as JamArchive, design: { bricks: [], grid: createBuildGrid() } }
    const drawing = new Group()
    registerViewerExtension({
      onTextureCreated: () => undefined,
      getRaceDisplay: () => null,
    })
    const isOriginalKept = getBuiltCarDrawing(request) === null

    // Act
    registerViewerExtension({
      onTextureCreated: () => undefined,
      getRaceDisplay: () => null,
      getBuiltCarDrawing: () => drawing,
    })

    // Assert
    expect([isOriginalKept, getBuiltCarDrawing(request)]).toEqual([true, drawing])
  })
})
