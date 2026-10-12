import { EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import { COMPUTER_CONTROLLER } from '../../types/racer-transitions/racer-transitions.ts'
import {
  getIsScreenFaderActive,
  startScreenFade,
  updateScreenFader,
} from '../../types/screen-fader/screen-fader.ts'
import type { ScreenFader } from '../../types/screen-fader/screen-fader.types.ts'
import type { RaceState } from '../../types/race.types.ts'
import type { PowerUpStep } from '../../../power-ups/index.ts'
import type { WarpStates } from './warp-fade.types.ts'

// 0x0045d780: a human's warp starts the blue fade when its starting phase has less than 200 ms to go (compared before the
// frame's countdown, `cmp ecx, 0xc8`), and the fade runs for as many (`push 0xc8`).
const WARP_FADE_START_MILLISECONDS = 200 // 0x0045d79f
const WARP_FADE_MILLISECONDS = 200 // 0x0045d7da
const WARP_FADE_BLUE = 100 // 0x0045d7f2 (`mov byte ptr [esp + 0xa], 0x64`)
const WARP_FADE_COLOUR = Object.freeze({ red: 0, green: 0, blue: WARP_FADE_BLUE })

// Race_Update 0x00435220: the power-ups' update (the warp's slot +8, 0x0045d780, starts the fade from the effect's state
// at the start of the frame) comes first and the fader's own update (0x00494f60) with the frame's time step later.
export const getScreenFaderAfterUpdate = (
  state: RaceState,
  stepMilliseconds: number
): ScreenFader => {
  const { effects, activeEffectIds } = state.powerUpStep.world.effects
  const started = activeEffectIds.reduce((fader, effectId) => {
    const effect = effects[effectId]
    if (
      effect?.kind !== PowerUpEffectKind.WARP ||
      effect.state !== EffectState.STARTING ||
      effect.timerMilliseconds >= WARP_FADE_START_MILLISECONDS ||
      effect.ownerRacer === null ||
      getIsScreenFaderActive(fader)
    )
      return fader
    const racer = state.racerSet.racers[effect.ownerRacer]
    if (racer === undefined || racer.controllerKind === COMPUTER_CONTROLLER) return fader
    const playerIndex = state.playerRacerIndices.indexOf(effect.ownerRacer)
    return startScreenFade(
      fader,
      {
        milliseconds: WARP_FADE_MILLISECONDS,
        isFadingOut: false,
        playerIndex: playerIndex < 0 ? null : playerIndex,
      },
      WARP_FADE_COLOUR
    )
  }, state.screenFader)
  return updateScreenFader(started, stepMilliseconds)
}

export const getWarpStates = (
  powerUpStep: PowerUpStep,
  racerIndex: number
): WarpStates => {
  const { effects, activeEffectIds } = powerUpStep.world.effects
  const owned = activeEffectIds.flatMap((effectId) => {
    const effect = effects[effectId]
    return effect?.kind === PowerUpEffectKind.WARP && effect.ownerRacer === racerIndex ? [effect] : []
  })
  return Object.freeze({
    isStarting: owned.some((effect) => effect.state === EffectState.STARTING),
    isCarrying: owned.some((effect) => effect.state === EffectState.ACTIVE),
  })
}
