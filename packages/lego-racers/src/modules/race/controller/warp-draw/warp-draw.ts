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

// Race_Render 0x004354d0 draws a local player's view with the effects' fade (0x0045a8a0) only while that player's racer
// is not off the track (racer flag 0x10); otherwise it draws the effects without it (0x0045a7b0).
const WARP_DISABLED_FLAG = 0x10

const getIsFadeDrawn = (state: RaceState): boolean =>
  state.playerRacerIndices.some((index) => {
    const racer = state.racerSet.racers[index]
    return racer !== undefined && (racer.flags & WARP_DISABLED_FLAG) === 0
  })

const getStateAfterWarpDraw = (
  state: RaceState,
  effect: PowerUpEffect,
  isFadeDrawn: boolean
): RaceState => {
  const owner = effect.ownerRacer
  if (owner === null) return state
  const { arithmetic, tables } = state.context
  if (effect.state === EffectState.STARTING) {
    // 0x0045dbe0: the fade runs in every racer's warp.
    if (!isFadeDrawn || effect.timerMilliseconds >= FADE_MILLISECONDS) return state
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
export const getStateWithWarpsDrawn = (state: RaceState): RaceState => {
  const isFadeDrawn = getIsFadeDrawn(state)
  const marked = state.racerSet.racers.reduce(
    (current, racer, index) =>
      racer.vehicle.pendingPartsMarkScale === null
        ? current
        : getStateWithRacer(current, index, (candidate) =>
            getRacerWithPartsMarked(
              current.context.arithmetic,
              Object.freeze({
                ...candidate,
                vehicle: Object.freeze({ ...candidate.vehicle, pendingPartsMarkScale: null }),
              }),
              racer.vehicle.pendingPartsMarkScale ?? 1
            )
          ),
    state
  )
  return marked.powerUpStep.world.effects.activeEffectIds.reduce((current, effectId) => {
    const effect = state.powerUpStep.world.effects.effects[effectId]
    return effect === undefined || effect.kind !== PowerUpEffectKind.WARP
      ? current
      : getStateAfterWarpDraw(current, effect, isFadeDrawn)
  }, marked)
}
