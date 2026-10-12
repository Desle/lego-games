import { HudFont } from '../../types/hud-font/hud-font.ts'
import type { HudTextCommand, HudInput, HudRacerView } from '../../types/race-hud.types.ts'
import { getHudLayout } from '../hud-layout/hud-layout.ts'
import { formatHudTime } from '../hud-time/hud-time.ts'
import { createHudState, finishHud, getHudFrame, startHudCountdown } from './hud-frame.ts'

const measureText = (font: string, text: string) => ({
  width: text.length * (font === HudFont.DIGITS ? 30 : 10),
  height: font === HudFont.DIGITS ? 40 : 16,
})
const strings = new Map<number, string>([
  [0x21, 'GAP'],
  [0x24, 'WRONG WAY'],
  [0x25, 'BEST'],
  [0x27, 'LAP'],
  [0x28, 'FINISH'],
  [0x29, 'GO'],
  [0x19, '1ST'],
  [0x1a, '2ND'],
  [0x1b, '3RD'],
])
const getString = (stringId: number) => strings.get(stringId) ?? ''
const imageNames = ['SPEED', 'DOT', 'CANNON', 'GRAPPLE', 'WAND', 'ROCKET', 'OILCAN', 'BARREL']
const imageSizes = new Map(imageNames.map((name) => [name, { width: 32, height: 32 }]))
const layout = getHudLayout({
  screenWidth: 640,
  screenHeight: 480,
  measureText,
  getString,
  holderSize: { width: 64, height: 64 },
})

const racer: HudRacerView = {
  currentLap: 0,
  lapCount: 3,
  lapMilliseconds: [12_340, 0, 0, 0, 0],
  racePosition: 2,
  isWrongWay: false,
  isWarping: false,
  heldPowerUp: { kindCode: 0, level: 0 },
}

const getInput = (overrides: Partial<HudInput> = {}): HudInput => ({
  frameMilliseconds: 16,
  minimap: null,
  layout,
  racer,
  getString,
  imageNames: [...imageNames, ...Array.from({ length: 24 }, (_, index) => `IMAGE${String(index)}`)],
  getImageSize: (name) => imageSizes.get(name) ?? { width: 16, height: 16 },
  measureText,
  ...overrides,
})

describe('formatHudTime', () => {
  it.each([
    [0, '0:00:00'],
    [83_450, '1:23:45'],
    [599_990, '9:59:99'],
    [600_000, '10:00:00'],
    [3_599_880, '59:59:88'],
    [3_600_000 + 1230, '0:01:23'],
  ])('formats %i ms as %s', (milliseconds, expected) => {
    // Arrange / Act
    const text = formatHudTime(milliseconds)

    // Assert
    expect(text).toBe(expected)
  })
})

describe('getHudLayout', () => {
  it('scales the 640 by 480 design to the screen and finds the columns and rows', () => {
    // Arrange / Act / Assert
    expect(layout.horizontalScale).toBeCloseTo(1, 5)
    expect(layout.verticalScale).toBeCloseTo(1, 5)
    expect(layout.shortTimeWidth).toBe(70)
    expect(layout.longTimeWidth).toBe(80)
    expect(layout.timeColumnX).toBe(640 - ((80 * 11) >> 3))
    expect(layout.centerX).toBe(320)
    expect(layout.positionX).toBe(64)
    expect(layout.holderX).toBe(20)
    expect(layout.wrongWayY).toBe(96)
    expect(layout.firstRowY).toBe(7)
    expect(layout.secondRowY).toBe(layout.firstRowY + 14)
  })
})

describe('getHudFrame countdown', () => {
  it('shows 3 with the second tick on the first frame', () => {
    // Arrange
    const state = startHudCountdown(createHudState())

    // Act
    const frame = getHudFrame(state, getInput())

    // Assert
    expect(frame.commands[0]).toMatchObject({ kind: 'text', text: '3', font: HudFont.DIGITS })
    expect(frame.soundIds).toEqual([0])
    expect(frame.state.countdownMilliseconds).toBe(17)
  })

  it('counts 3, 2, 1 then GO and ticks once per second', () => {
    // Arrange
    const first = startHudCountdown(createHudState())
    const at = (milliseconds: number) =>
      getHudFrame(
        { ...first, countdownMilliseconds: milliseconds },
        getInput({ frameMilliseconds: 16 })
      )

    // Act
    const two = at(1_100)
    const one = at(2_100)
    const go = at(3_100)
    const goStart = at(2_990)
    const sameSecond = at(1_100 + 16)

    // Assert
    expect(two.commands[0]).toMatchObject({ text: '2' })
    expect(one.commands[0]).toMatchObject({ text: '1' })
    expect(go.commands[0]).toMatchObject({ text: 'GO' })
    expect(goStart.soundIds).toEqual([0xf])
    expect(go.soundIds).toEqual([])
    expect(sameSecond.soundIds).toEqual([])
  })

  it('draws the numeral cyan and shrinking through its second', () => {
    // Arrange
    const state = { ...createHudState(), countdownMilliseconds: 500 }

    // Act
    const early = getHudFrame(state, getInput({ frameMilliseconds: 16 }))
    const late = getHudFrame(
      { ...state, countdownMilliseconds: 900 },
      getInput({ frameMilliseconds: 16 })
    )

    // Assert
    const earlyText = early.commands[0]
    const lateText = late.commands[0]
    expect(earlyText).toMatchObject({ color: 0xff00ffff })
    expect(
      earlyText?.kind === 'text' && lateText?.kind === 'text' && earlyText.scaleX > lateText.scaleX
    ).toBe(true)
  })

  it('stops after five seconds', () => {
    // Arrange
    const state = { ...createHudState(), countdownMilliseconds: 4_990 }

    // Act
    const frame = getHudFrame(state, getInput({ frameMilliseconds: 16 }))

    // Assert
    expect(frame.state.countdownMilliseconds).toBe(0)
    expect(
      frame.commands.find((command) => command.kind === 'text' && command.text === 'GO')
    ).toBeUndefined()
  })

  it('shows the finish text after the finish and counts down to a limit', () => {
    // Arrange
    const state = finishHud(createHudState(), 1)

    // Act
    const frame = getHudFrame(state, getInput({ frameMilliseconds: 100 }))
    const limited = getHudFrame(
      { ...state, countdownMilliseconds: -59_990 },
      getInput({ frameMilliseconds: 100 })
    )

    // Assert
    expect(frame.commands[0]).toMatchObject({ text: 'FINISH', font: HudFont.DIGITS, color: null })
    expect(frame.state.countdownMilliseconds).toBe(-101)
    expect(limited.state.countdownMilliseconds).toBe(-60_000)
  })
})

describe('getHudFrame rows', () => {
  it('shows the lap number, its label and the running lap time', () => {
    // Arrange
    const state = createHudState()

    // Act
    const frame = getHudFrame(state, getInput())

    // Assert
    const texts = frame.commands.flatMap((command) =>
      command.kind === 'text' ? [command.text] : []
    )
    expect(texts).toContain('1')
    expect(texts).toContain('LAP')
    expect(texts).toContain('0:12:34')
    expect(frame.state.lapText).toBe('1')
    expect(frame.state.shownLap).toBe(0)
  })

  it('puts the label left of the number and the time column right of both', () => {
    // Arrange / Act
    const frame = getHudFrame(createHudState(), getInput())

    // Assert
    const find = (text: string) =>
      frame.commands.find(
        (command): command is HudTextCommand => command.kind === 'text' && command.text === text
      )
    const number = find('1')
    const label = find('LAP')
    const time = find('0:12:34')
    expect(label?.x).toBeLessThan(number?.x ?? 0)
    expect(number?.x).toBeLessThan(time?.x ?? 0)
    expect(time?.y).toBe(layout.firstRowY)
  })

  it('shows the previous lap time and the best lap after a lap is done', () => {
    // Arrange
    const state = { ...createHudState(), shownLap: 0, lapText: '1' }
    const lapTwo = { ...racer, currentLap: 1, lapMilliseconds: [61_000, 1_000, 0, 0, 0] }

    // Act
    const frame = getHudFrame(state, getInput({ racer: lapTwo }))

    // Assert
    expect(frame.state.bestLapMilliseconds).toBe(61_000)
    expect(frame.state.bestTimeText).toBe('1:01:00')
    expect(frame.state.lapText).toBe('2')
    const texts = frame.commands.flatMap((command) =>
      command.kind === 'text' ? [command.text] : []
    )
    expect(texts).toContain('BEST')
    expect(texts).toContain('1:01:00')
  })

  it('hides the running time on the off beats of the first three seconds of a lap', () => {
    // Arrange
    const state = { ...createHudState(), shownLap: 1, lapText: '2' }
    const off = { ...racer, currentLap: 1, lapMilliseconds: [61_000, 300, 0, 0, 0] }

    // Act
    const frame = getHudFrame(state, getInput({ racer: off }))

    // Assert
    const texts = frame.commands.flatMap((command) =>
      command.kind === 'text' ? [command.text] : []
    )
    expect(texts).not.toContain('0:00:30')
    expect(texts).not.toContain('1:01:00')
  })

  it('aligns a seven character time with the longer ones', () => {
    // Arrange / Act
    const frame = getHudFrame(createHudState(), getInput())

    // Assert
    const time = frame.commands.find(
      (command): command is HudTextCommand => command.kind === 'text' && command.text === '0:12:34'
    )
    expect(time?.x).toBe(layout.timeColumnX + layout.longTimeWidth - layout.shortTimeWidth)
  })

  it('shows the place and pops the number when it changes', () => {
    // Arrange
    const state = createHudState()

    // Act
    const first = getHudFrame(state, getInput({ frameMilliseconds: 100 }))
    const later = getHudFrame(first.state, getInput({ frameMilliseconds: 100 }))

    // Assert
    const digit = (frame: typeof first) =>
      frame.commands.find((command) => command.kind === 'text' && command.font === HudFont.DIGITS)
    expect(first.state.shownPlace).toBe(1)
    expect(digit(first)).toMatchObject({ text: '2' })
    expect(
      first.commands.some((command) => command.kind === 'text' && command.text === '2ND')
    ).toBe(true)
    const firstScale =
      digit(first)?.kind === 'text' ? (digit(first) as { scaleX: number }).scaleX : 0
    const laterScale =
      digit(later)?.kind === 'text' ? (digit(later) as { scaleX: number }).scaleX : 0
    expect(firstScale).toBeGreaterThan(1.5)
    expect(laterScale).toBeGreaterThan(firstScale)
  })

  it('hides the place after the last racer (place 8)', () => {
    // Arrange
    const last = { ...racer, racePosition: 9 }

    // Act
    const frame = getHudFrame(createHudState(), getInput({ racer: last }))

    // Assert
    expect(
      frame.commands.some((command) => command.kind === 'text' && command.font === HudFont.DIGITS)
    ).toBe(false)
  })

  it('warns when going the wrong way', () => {
    // Arrange
    const wrong = { ...racer, isWrongWay: true }

    // Act
    const frame = getHudFrame(createHudState(), getInput({ racer: wrong }))

    // Assert
    expect(
      frame.commands.find((command) => command.kind === 'text' && command.text === 'WRONG WAY')
    ).toMatchObject({
      x: layout.wrongWayX,
      y: layout.wrongWayY,
    })
  })

  it('draws nothing but the countdown while the racer is warping', () => {
    // Arrange
    const warping = { ...racer, isWarping: true }

    // Act
    const frame = getHudFrame(createHudState(), getInput({ racer: warping }))

    // Assert
    expect(frame.commands).toEqual([])
  })
})

describe('getHudFrame held power-up', () => {
  it('draws nothing for an empty hand', () => {
    // Arrange / Act
    const frame = getHudFrame(createHudState(), getInput())

    // Assert
    expect(frame.commands.some((command) => command.kind === 'image')).toBe(false)
  })

  it('draws the holder, its tinted frame and the icon for the held kind and level', () => {
    // Arrange
    const holding = { ...racer, heldPowerUp: { kindCode: 1, level: 1 } }

    // Act
    const frame = getHudFrame(createHudState(), getInput({ racer: holding }))

    // Assert
    const images = frame.commands.flatMap((command) => (command.kind === 'image' ? [command] : []))
    expect(images.map((image) => image.imageIndex)).toEqual([0xb, 0xc, 3, 0xd])
    expect(images[1]?.color).toBe(0xff0000ff)
    expect(images[0]).toMatchObject({ x: layout.holderX, y: layout.holderY })
    expect(images[2]?.imageName).toBe('GRAPPLE')
  })
})
