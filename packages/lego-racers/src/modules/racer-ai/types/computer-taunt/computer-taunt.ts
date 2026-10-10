import { drawRandomValue } from '../../../random-table/index.ts'
import type { RandomTable, RandomTablePosition } from '../../../random-table/index.ts'
import type { ComputerTauntStep, ComputerTimers } from '../racer-ai.types.ts'

// LEA r,[value*8 + 0x7d0] and LEA r,[value*4 + 0x1388].
const TAUNT_BASE_MILLISECONDS = 0x7d0
const TAUNT_VALUE_SCALE = 8
const VOICE_BASE_MILLISECONDS = 0x1388
const VOICE_VALUE_SCALE = 4
// 0x00437a0d: the taunt query 0x0043ca60(origin, forward axis, 0.0, 169.0, 0.3).
export const TAUNT_MINIMUM_DISTANCE_SQUARED = 0
export const TAUNT_MAXIMUM_DISTANCE_SQUARED = 169
export const TAUNT_MINIMUM_COSINE = Math.fround(0.3)
// 0x00439003..0x0043901a: the power-up 1 target query (100.0, 62,500.0, 0.96).
export const POWER_UP_TARGET_MINIMUM_DISTANCE_SQUARED = 100
export const POWER_UP_TARGET_MAXIMUM_DISTANCE_SQUARED = 62500
export const POWER_UP_TARGET_MINIMUM_COSINE = Math.fround(0.96)

// 0x004370f6..0x00437144 (racer set-up 0x00436df0): two draws, the taunt timer first.
export const createComputerTimers = (
  table: RandomTable,
  position: RandomTablePosition
): ComputerTimers => {
  const tauntDraw = drawRandomValue(table, position)
  const voiceDraw = drawRandomValue(table, tauntDraw.position)
  return Object.freeze({
    position: voiceDraw.position,
    tauntMilliseconds: tauntDraw.value * TAUNT_VALUE_SCALE + TAUNT_BASE_MILLISECONDS,
    voiceMilliseconds: voiceDraw.value * VOICE_VALUE_SCALE + VOICE_BASE_MILLISECONDS,
  })
}

// 0x004377f0: racer +0xd34 counts down (to 0 when the step exceeds it); at 0 a computer racer with a
// racer near ahead (the taunt query) taunts (0x00439c90) and waits value * 8 + 2000 ms, else 2,000 ms.
export const updateComputerTaunt = (
  table: RandomTable,
  position: RandomTablePosition,
  tauntMilliseconds: number,
  stepMilliseconds: number,
  isComputer: boolean,
  isRacerNearAhead: boolean
): ComputerTauntStep => {
  const remaining = stepMilliseconds > tauntMilliseconds ? 0 : tauntMilliseconds - stepMilliseconds
  if (remaining !== 0 || !isComputer) {
    return Object.freeze({ position, tauntMilliseconds: remaining, isTaunting: false })
  }
  if (!isRacerNearAhead) {
    return Object.freeze({
      position,
      tauntMilliseconds: TAUNT_BASE_MILLISECONDS,
      isTaunting: false,
    })
  }
  const draw = drawRandomValue(table, position)
  return Object.freeze({
    position: draw.position,
    tauntMilliseconds: draw.value * TAUNT_VALUE_SCALE + TAUNT_BASE_MILLISECONDS,
    isTaunting: true,
  })
}
