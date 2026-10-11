import { DEFAULT_KEYBOARD_BINDINGS } from '@lego-games/lego-racers/race-input'
import type { RaceInputSnapshot } from '@lego-games/lego-racers/race-input'
import type { RaceInputSource } from './race-input-source.types.ts'

const BOUND_KEY_CODES = new Set(DEFAULT_KEYBOARD_BINDINGS.map((binding) => binding.keyCode))

// The keyboard and the first connected gamepad as a snapshot the race-input module maps to the nine bindings.
// A bound key does not scroll the page.
export const createRaceInputSource = (): RaceInputSource => {
  const pressedKeyCodes = new Set<string>()
  const onKeyDown = (event: KeyboardEvent) => {
    if (BOUND_KEY_CODES.has(event.code)) event.preventDefault()
    pressedKeyCodes.add(event.code)
  }
  const onKeyUp = (event: KeyboardEvent) => pressedKeyCodes.delete(event.code)
  const onBlur = () => pressedKeyCodes.clear()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  const read = (): RaceInputSnapshot => {
    const gamepad = navigator.getGamepads().find((candidate) => candidate !== null) ?? null
    return {
      pressedKeyCodes: new Set(pressedKeyCodes),
      gamepad:
        gamepad === null
          ? null
          : {
              axes: [...gamepad.axes],
              pressedButtonIndices: gamepad.buttons.flatMap((button, index) =>
                button.pressed ? [index] : []
              ),
            },
    }
  }
  return Object.freeze({
    read,
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    },
  })
}
