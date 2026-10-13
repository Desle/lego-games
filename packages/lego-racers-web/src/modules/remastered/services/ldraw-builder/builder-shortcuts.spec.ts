import { getBuilderKeyCommand, QUICK_COLOR_CODES } from './builder-shortcuts.ts'
import { BuilderAction } from './builder-shortcuts.types.ts'

const press = (key: string, isCommand = false, isShift = false, isOption = false) => ({
  key,
  isCommand,
  isShift,
  isOption,
})

describe('getBuilderKeyCommand', () => {
  it('reads the Mac shortcuts', () => {
    // Arrange
    const presses = [
      press('r'),
      press('R', false, true),
      press('Backspace'),
      press('c', true),
      press('v', true),
      press('d', true),
      press('z', true),
      press('z', true, true),
      press('a', true),
      press('s', true),
      press('ArrowUp', true),
      press('ArrowDown', true, true),
      press('ArrowLeft'),
      press('Escape'),
      press('?', false, true),
    ]

    // Act
    const actions = presses.map((keyPress) => getBuilderKeyCommand(keyPress)?.action)

    // Assert
    expect(actions).toEqual([
      BuilderAction.ROTATE,
      BuilderAction.ROTATE_BACK,
      BuilderAction.DELETE,
      BuilderAction.COPY,
      BuilderAction.PASTE,
      BuilderAction.DUPLICATE,
      BuilderAction.UNDO,
      BuilderAction.REDO,
      BuilderAction.SELECT_ALL,
      BuilderAction.SAVE,
      BuilderAction.RAISE_PLATE,
      BuilderAction.LOWER_BRICK,
      BuilderAction.MOVE_LEFT,
      BuilderAction.CANCEL,
      BuilderAction.SHORTCUTS,
    ])
  })

  it('gives the digits their quick colour and leaves Option and unknown keys to the browser', () => {
    // Arrange
    const presses = [press('3'), press('r', false, false, true), press('q'), press('c')]

    // Act
    const commands = presses.map((keyPress) => getBuilderKeyCommand(keyPress))

    // Assert
    expect(commands).toEqual([
      { action: BuilderAction.QUICK_COLOR, quickColorIndex: 2 },
      null,
      null,
      null,
    ])
    expect(QUICK_COLOR_CODES[2]).toBe(4)
  })

  it('tilts with T and nudges with Option and the arrows', () => {
    // Arrange
    const presses = [
      press('t'),
      press('T', false, true),
      press('ArrowLeft', false, false, true),
      press('ArrowRight', false, false, true),
      press('ArrowUp', false, false, true),
      press('ArrowDown', false, false, true),
      press('ArrowUp', true, false, true),
      press('ArrowDown', true, false, true),
      press('ArrowUp', false, true, true),
    ]

    // Act
    const actions = presses.map((keyPress) => getBuilderKeyCommand(keyPress)?.action ?? null)

    // Assert
    expect(actions).toEqual([
      BuilderAction.TILT,
      BuilderAction.TILT_BACK,
      BuilderAction.NUDGE_LEFT,
      BuilderAction.NUDGE_RIGHT,
      BuilderAction.NUDGE_AWAY,
      BuilderAction.NUDGE_TOWARD,
      BuilderAction.NUDGE_UP,
      BuilderAction.NUDGE_DOWN,
      null,
    ])
  })
})
