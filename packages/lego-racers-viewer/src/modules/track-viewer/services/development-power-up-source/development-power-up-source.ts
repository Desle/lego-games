import type {
  DevelopmentPowerUpRequest,
  DevelopmentPowerUpSource,
} from './development-power-up-source.types.ts'

const KIND_BY_KEY_CODE: ReadonlyMap<string, number> = new Map([
  ['Digit1', 1],
  ['Digit2', 2],
  ['Digit3', 3],
  ['Digit4', 4],
])
const LEVEL_DOWN_KEY_CODE = 'Digit5'
const LEVEL_UP_KEY_CODE = 'Digit6'
const HIGHEST_LEVEL = 3

// Keys 1 to 4 give the player that brick kind at the current level (3 at first); 5 and 6 lower and raise the level.
export const createDevelopmentPowerUpSource = (): DevelopmentPowerUpSource => {
  let level = HIGHEST_LEVEL
  let request: DevelopmentPowerUpRequest | null = null
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return
    const kind = KIND_BY_KEY_CODE.get(event.code)
    if (kind !== undefined) request = { kind, level }
    if (event.code === LEVEL_DOWN_KEY_CODE) level = Math.max(0, level - 1)
    if (event.code === LEVEL_UP_KEY_CODE) level = Math.min(HIGHEST_LEVEL, level + 1)
  }
  window.addEventListener('keydown', onKeyDown)
  return Object.freeze({
    take: () => {
      const taken = request
      request = null
      return taken
    },
    dispose: () => window.removeEventListener('keydown', onKeyDown),
  })
}
