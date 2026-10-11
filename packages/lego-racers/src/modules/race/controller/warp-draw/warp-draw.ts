import { EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect } from '../../../power-ups/index.ts'
import {
  getRacerAfterWarpDraw,
  getRacerWithPartsMarked,
  getWarpFadeScale,
} from '../../../racer/index.ts'
import type { Racer } from '../../../racer/index.ts'
import type { RaceState } from '../../types/race.types.ts'

// 0x0045dbe0: the car's parts take the fade only while the warp has less than this many milliseconds to go.
const FADE_MILLISECONDS = 0xfa

const getStateWithRacer = (
  state: RaceState,
  racerIndex: number,
  change: (racer: Racer) => Racer
): RaceState =>
  Object.freeze({
    ...state,
    racerSet: Object.freeze({
      ...state.racerSet,
      racers: Object.freeze(
        state.racerSet.racers.map((racer, index) => (index === racerIndex ? change(racer) : racer))
      ),
    }),
  })

const getStateAfterWarpDraw = (state: RaceState, effect: PowerUpEffect): RaceState => {
  const owner = effect.ownerRacer
  if (owner === null) return state
  const { arithmetic, tables } = state.context
  if (effect.state === EffectState.STARTING) {
    // 0x0045dbe0: the fade runs in every racer's warp.
    if (effect.timerMilliseconds >= FADE_MILLISECONDS) return state
    const scale = getWarpFadeScale(arithmetic, tables, effect.timerMilliseconds)
    return getStateWithRacer(state, owner, (racer) =>
      getRacerWithPartsMarked(arithmetic, racer, scale)
    )
  }
  // 0x0045d940 draws for the camera of the warping racer, so only a local player's warp does.
  if (effect.state === EffectState.ACTIVE && state.playerRacerIndices.includes(owner)) {
    return getStateWithRacer(state, owner, (racer) => getRacerAfterWarpDraw(arithmetic, racer))
  }
  return state
}

// The draw after Race_Update touches the warping racer's parts; the original does it inside its draw, and the next
// update and the golden trace see it, so it is part of the frame here.
export const getStateWithWarpsDrawn = (state: RaceState): RaceState =>
  state.powerUpStep.world.effects.activeEffectIds.reduce((current, effectId) => {
    const effect = state.powerUpStep.world.effects.effects[effectId]
    return effect === undefined || effect.kind !== PowerUpEffectKind.WARP
      ? current
      : getStateAfterWarpDraw(current, effect)
  }, state)
