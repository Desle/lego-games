import {
  clearViewerExtensions,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { CLASSIC_RACE_DISPLAY, getRaceDisplay } from './race-display.ts'

const WINDOW = { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 2 }

describe('getRaceDisplay', () => {
  afterEach(() => clearViewerExtensions())

  it('is the original 800 x 600 stage when nothing is registered', () => {
    // Arrange / Act
    const display = getRaceDisplay(WINDOW)

    // Assert
    expect(display).toBe(CLASSIC_RACE_DISPLAY)
    expect(display.stageSize).toEqual({ width: 800, height: 600 })
  })

  it('takes the layout of the first extension that gives one', () => {
    // Arrange
    const layout = { ...CLASSIC_RACE_DISPLAY, isFullWindow: true }
    registerViewerExtension(NEUTRAL_EXTENSION)
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getRaceDisplay: () => layout })

    // Act
    const display = getRaceDisplay(WINDOW)

    // Assert
    expect(display).toBe(layout)
  })
})
