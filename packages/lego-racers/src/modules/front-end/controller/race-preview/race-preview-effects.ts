import { getActiveCinemaVertexEffects } from '../../../cinema/index.ts'
import type { ActiveCinemaVertexEffect, Cinema } from '../../../cinema/index.ts'
import type {
  RacePreviewColourShift,
  RacePreviewEffects,
  RacePreviewEffectsInput,
  RacePreviewVertexEffect,
} from '../../types/race-preview.types.ts'

// 0x004af220: milliseconds to seconds.
const SECONDS_PER_MILLISECOND = Math.fround(0.001)
const CHANNEL_COUNT = 4

const getLoopCount = (cinema: Cinema, milliseconds: number): number =>
  cinema.framesPerSecond === 0 || cinema.lengthFrames === 0
    ? 0
    : Math.floor(milliseconds / ((cinema.lengthFrames * 1000) / cinema.framesPerSecond))

// FUN_004a4ca0: starting an effect makes its biases the integers of the file.
const startEffect = (active: ActiveCinemaVertexEffect): RacePreviewVertexEffect =>
  Object.freeze({
    dummyIndex: active.dummyIndex,
    instanceName: active.effect.instanceName,
    shifts: active.effect.shifts,
    rates: active.effect.rates,
    currentBiases: Object.freeze([...active.effect.biases]),
  })

// FUN_004a4d10: the rates times the frame's seconds are added to the biases, but only when one of the three steps is at
// least one whole unit (the original tests each step with a truncation to an integer, and otherwise adds nothing).
const getRampedEffect = (
  effect: RacePreviewVertexEffect,
  frameMilliseconds: number
): RacePreviewVertexEffect => {
  const seconds = Math.fround(frameMilliseconds * SECONDS_PER_MILLISECOND)
  const steps = [0, 1, 2].map((channel) => Math.fround((effect.rates[channel] ?? 0) * seconds))
  if (steps.every((step) => Math.trunc(step) === 0)) return effect
  return Object.freeze({
    ...effect,
    currentBiases: Object.freeze(
      steps.map((step, channel) => Math.fround((effect.currentBiases[channel] ?? 0) + step))
    ),
  })
}

// Cinema_Update 0x00466d90: the timeline starts the effects of the dummies that came on and stops those that went off, then
// every effect that is on ramps (`FUN_004a2dc0`); a switch stops them all (`FUN_004a3150`) and starts the new cinema's.
export const advanceRacePreviewEffects = (
  input: RacePreviewEffectsInput
): RacePreviewEffects | null => {
  const { cinema, events, previous } = input
  if (cinema === null) return null
  const isSame = previous !== null && previous.cinemaName === cinema.name && !input.isRestarted
  const isLooped =
    getLoopCount(cinema, input.milliseconds) !== getLoopCount(cinema, input.previousMilliseconds)
  const kept = isSame && !isLooped ? previous.active : []
  const on = getActiveCinemaVertexEffects(cinema, events, isSame ? input.milliseconds : 0)
  const started = [
    ...kept.filter((effect) => on.some((active) => active.dummyIndex === effect.dummyIndex)),
    ...on
      .filter((active) => !kept.some((effect) => effect.dummyIndex === active.dummyIndex))
      .map(startEffect),
  ]
  return Object.freeze({
    cinemaName: cinema.name,
    active: Object.freeze(
      started.map((effect) => getRampedEffect(effect, input.frameMilliseconds))
    ),
  })
}

// FUN_004a4da0: the biases are the truncated floats.
export const getRacePreviewColourShifts = (
  effects: RacePreviewEffects | null
): readonly RacePreviewColourShift[] =>
  (effects?.active ?? []).map((effect) =>
    Object.freeze({
      instanceName: effect.instanceName,
      shifts: Object.freeze(
        Array.from({ length: CHANNEL_COUNT }, (_, channel) => effect.shifts[channel] ?? 0)
      ),
      biases: Object.freeze(
        Array.from({ length: CHANNEL_COUNT }, (_, channel) =>
          Math.trunc(effect.currentBiases[channel] ?? 0)
        )
      ),
    })
  )
