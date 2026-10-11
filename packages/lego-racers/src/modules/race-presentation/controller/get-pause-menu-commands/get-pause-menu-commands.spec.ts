import { PauseMenuMode } from '../../../race/index.ts'
import type { HudCommand } from '../../../race-hud/index.ts'
import type { HudContext } from '../../types/race-presentation.types.ts'
import { getPauseMenuCommands } from './get-pause-menu-commands.ts'

const STRINGS: Readonly<Record<number, string>> = {
  0x0e: 'CONTINUE',
  0x0f: 'RESTART RACE',
  0x10: 'RESTART CIRCUIT',
  0x11: 'EXIT',
  0x12: 'YES',
  0x13: 'NO',
  0x14: 'GAME PAUSED',
  0x15: 'NOT BEATEN',
  0x16: 'RACE AGAIN?',
  0x2c: 'ARE YOU SURE?',
}
const CHARACTER_WIDTH = 10
const LINE_HEIGHT = 20

const context = {
  layout: { screenWidth: 800, screenHeight: 600 },
  getString: (stringId: number) => STRINGS[stringId] ?? '',
  measureText: (_font: string, text: string) => ({
    width: text.length * CHARACTER_WIDTH,
    height: LINE_HEIGHT,
  }),
} as unknown as HudContext

const getState = (
  mode: (typeof PauseMenuMode)[keyof typeof PauseMenuMode],
  overrides: { selection?: number; blinkMilliseconds?: number; isAnswered?: boolean } = {},
  isCircuit = false
) => ({
  pauseMenu: {
    mode,
    selection: overrides.selection ?? 0,
    isAnswered: overrides.isAnswered ?? false,
    pendingAction: 'none' as const,
    blinkMilliseconds: overrides.blinkMilliseconds ?? 0,
  },
  pointsRecord: isCircuit ? ({} as never) : null,
  ghost: null,
})

const getTexts = (commands: readonly HudCommand[]) =>
  commands.flatMap((command) => (command.kind === 'text' ? [command.text] : []))

describe('getPauseMenuCommands', () => {
  it('draws nothing while no menu is open', () => {
    // Arrange
    const state = getState(PauseMenuMode.NONE)

    // Act
    const commands = getPauseMenuCommands(state, context)

    // Assert
    expect(commands).toEqual([])
  })

  it('lists the pause menu items under the title (0x00436010 mode 1)', () => {
    // Arrange
    const state = getState(PauseMenuMode.PAUSED)

    // Act
    const commands = getPauseMenuCommands(state, context)

    // Assert
    expect(getTexts(commands)).toEqual(['GAME PAUSED', 'CONTINUE', 'RESTART RACE', 'EXIT'])
  })

  it('offers to restart the circuit when the race has a points record', () => {
    // Arrange
    const state = getState(PauseMenuMode.PAUSED, {}, true)

    // Act
    const commands = getPauseMenuCommands(state, context)

    // Assert
    expect(getTexts(commands)).toContain('RESTART CIRCUIT')
  })

  it('centres the lines on the screen one font line apart, dimmed by a black quad', () => {
    // Arrange
    const state = getState(PauseMenuMode.PAUSED)

    // Act
    const [dimmer, title, firstItem, secondItem] = getPauseMenuCommands(state, context)

    // Assert
    expect(dimmer).toEqual({
      kind: 'fill',
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      color: 0x40000000,
    })
    const lineHeight = LINE_HEIGHT + 2
    expect(title).toMatchObject({
      x: 400 - (11 * CHARACTER_WIDTH) / 2,
      y: 300 - 66 / 2 - lineHeight,
    })
    expect(firstItem).toMatchObject({ y: 267, color: 0xff24ffff })
    expect(secondItem).toMatchObject({ color: 0xff127f7f })
  })

  it('hides the selected item in the second half of the blink period', () => {
    // Arrange
    const state = getState(PauseMenuMode.PAUSED, { blinkMilliseconds: 250 })

    // Act
    const commands = getPauseMenuCommands(state, context)

    // Assert
    expect(getTexts(commands)).toEqual(['GAME PAUSED', 'RESTART RACE', 'EXIT'])
  })

  it('selects "no" first in the confirmation and titles it "are you sure"', () => {
    // Arrange
    const state = getState(PauseMenuMode.CONFIRMATION, { selection: 1 })

    // Act
    const commands = getPauseMenuCommands(state, context)

    // Assert
    expect(getTexts(commands)).toEqual(['ARE YOU SURE?', 'YES', 'NO'])
    expect(commands.at(-1)).toMatchObject({ text: 'NO', color: 0xff24ffff })
  })

  it('shows the ghost result with two heading lines', () => {
    // Arrange
    const state = getState(PauseMenuMode.RESULTS)

    // Act
    const commands = getPauseMenuCommands(state, context)

    // Assert
    expect(getTexts(commands)).toEqual(['NOT BEATEN', 'RACE AGAIN?', 'YES', 'NO'])
  })
})
