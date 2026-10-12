import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import { HudFont } from '@lego-games/lego-racers/race-hud'
import { getWidescreenDisplay } from './widescreen-display.ts'

const WINDOW = { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 2 }
const text = (x: number, y: number): HudCommand => ({
  kind: 'text',
  text: 'x',
  font: HudFont.TEXT,
  x,
  y,
  scaleX: 1,
  scaleY: 1,
  color: null,
})

describe('getWidescreenDisplay', () => {
  it('fills the window at the device resolution and lays the HUD out in 4:3', () => {
    // Arrange / Act
    const display = getWidescreenDisplay(WINDOW)

    // Assert
    expect(display.stageSize).toEqual({ width: 1920, height: 1080 })
    expect(display.pixelRatio).toBe(2)
    expect(display.hudDesignSize).toEqual({ width: 1440, height: 1080 })
    expect(display.isFullWindow).toBe(true)
  })

  it('moves right-anchored text with the right edge, centred text with the centre, left text not at all', () => {
    // Arrange
    const display = getWidescreenDisplay(WINDOW)

    // Act
    const [left, centre, right] = display.getHudCommands([
      text(100, 20),
      text(650, 20),
      text(1300, 20),
    ])

    // Assert
    expect([left, centre, right]).toEqual([text(100, 20), text(890, 20), text(1780, 20)])
  })

  it('anchors bottom elements to the bottom and stretches the dimmer over the whole window', () => {
    // Arrange
    const display = getWidescreenDisplay({
      innerWidth: 1200,
      innerHeight: 1200,
      devicePixelRatio: 1,
    })
    const dimmer: HudCommand = {
      kind: 'fill',
      x: 0,
      y: 0,
      width: 1200,
      height: 900,
      color: 0x80000000,
    }

    // Act
    const [bottomText, stretched] = display.getHudCommands([text(10, 800), dimmer])

    // Assert
    expect(bottomText).toEqual(text(10, 1100))
    expect(stretched).toEqual({ ...dimmer, height: 1200 })
  })
})
