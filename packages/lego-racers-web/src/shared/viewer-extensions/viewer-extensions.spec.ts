import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { DataTexture, Group } from 'three'
import {
  clearViewerExtensions,
  emitTextureCreated,
  getEffectModelDrawing,
  getMenuSurfaceScale,
  getCarDrawing,
  getDriverDrawing,
  getSoundReplacement,
  getIsClassic,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from './viewer-extensions.ts'

describe('viewer extensions', () => {
  afterEach(() => clearViewerExtensions())

  it('is classic until an extension is registered', () => {
    // Arrange
    const isClassicBefore = getIsClassic()

    // Act
    registerViewerExtension(NEUTRAL_EXTENSION)

    // Assert
    expect([isClassicBefore, getIsClassic()]).toEqual([true, false])
  })

  it('tells every extension about a new texture', () => {
    // Arrange
    const onTextureCreated = vi.fn()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, onTextureCreated })
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

  it('keeps the menu surface at its design with no opinion, and takes the first extension that has one', () => {
    // Arrange
    const classicScale = getMenuSurfaceScale(3)
    registerViewerExtension(NEUTRAL_EXTENSION)
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getMenuSurfaceScale: () => 2.5 })

    // Act
    const scale = getMenuSurfaceScale(3)

    // Assert
    expect([classicScale, scale]).toEqual([1, 2.5])
  })

  it('plays the first replacement sound an extension has', async () => {
    // Arrange
    const buffer = {} as AudioBuffer
    registerViewerExtension(NEUTRAL_EXTENSION)
    registerViewerExtension({
      ...NEUTRAL_EXTENSION,
      getSoundReplacement: () => Promise.resolve(buffer),
    })

    // Act
    const replacement = await getSoundReplacement({} as BaseAudioContext, 'A.PCM')

    // Assert
    expect(replacement).toBe(buffer)
  })

  it('draws an effect model as the original does until an extension offers a drawing', () => {
    // Arrange
    const request = { modelName: 'PUBRICKY', variant: 'shield' }
    const drawing = new Group()
    registerViewerExtension(NEUTRAL_EXTENSION)
    const isOriginalKept = getEffectModelDrawing(request) === null

    // Act
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getEffectModelDrawing: () => drawing })

    // Assert
    expect([isOriginalKept, getEffectModelDrawing(request)]).toEqual([true, drawing])
  })

  it('draws a car and a driver as the original does until an extension offers a drawing', () => {
    // Arrange
    const part = { model: {} as ModelScene, modelName: 'rrjmw', partBytes: null }
    const carRequest = { archive: {} as JamArchive, carCode: 'RRCM', design: null, wheels: part }
    const driverRequest = { archive: {} as JamArchive, driver: part }
    const carDrawing = { object: new Group(), applyPose: () => undefined, dispose: () => undefined }
    const driverDrawing = { ...carDrawing, animate: () => undefined }
    registerViewerExtension(NEUTRAL_EXTENSION)
    const originals = [getCarDrawing(carRequest), getDriverDrawing(driverRequest)]

    // Act
    registerViewerExtension({
      ...NEUTRAL_EXTENSION,
      getCarDrawing: () => carDrawing,
      getDriverDrawing: () => driverDrawing,
    })

    // Assert
    expect([originals, getCarDrawing(carRequest), getDriverDrawing(driverRequest)]).toEqual([
      [null, null],
      carDrawing,
      driverDrawing,
    ])
  })
})
