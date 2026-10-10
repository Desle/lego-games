import { drawRandomLowByte } from '../../../random-table/index.ts'
import type { RandomTable, RandomTablePosition } from '../../../random-table/index.ts'
import type {
  PowerUpUseDecisionValue,
  PowerUpUseInput,
  PowerUpUseResult,
  PowerUpUseSchedule,
  PowerUpUseStep,
} from '../racer-ai.types.ts'
import { PowerUpUseDecision } from './power-up-use-decision.ts'

const MAXIMUM_ACTIVE_POWER_UPS = 0x14
export const POWER_UP_CHECK_INTERVAL_MILLISECONDS = 0x96
export const POWER_UP_WAIT_MILLISECONDS = 0x3e8
// Racer +0xd04 bit tested with power-up level 3 for power-up 3 (TEST AH,0x10 at 0x00438fc6).
const RACER_POWER_UP_THREE_HOLD_FLAG = 0x1000
const POWER_UP_THREE_HOLD_LEVEL = 3
// Car body +0x6c0 bit 0x2 (racer +0xaa8) also keeps power-up 3.
const CAR_BODY_POWER_UP_THREE_HOLD_FLAG = 0x2

// Which personality chance (index into racer +0xd1c..) each held power-up compares against;
// from the jump table at 0x004390f0: 1 → +0xd1c, 2 → +0xd1f, 3 → +0xd1e, 4 → +0xd1d.
const CHANCE_INDEX_BY_POWER_UP: readonly number[] = Object.freeze([-1, 0, 3, 2, 1])

const getDecision = (
  position: RandomTablePosition,
  decision: PowerUpUseDecisionValue
): PowerUpUseResult => Object.freeze({ position, decision })

// 0x00438f20 (fastcall: racer): whether a computer racer uses its power-up now.
export const decidePowerUpUse = (
  table: RandomTable,
  position: RandomTablePosition,
  input: PowerUpUseInput
): PowerUpUseResult => {
  if (input.activePowerUpCount >= MAXIMUM_ACTIVE_POWER_UPS) {
    return getDecision(position, PowerUpUseDecision.WAIT)
  }
  if (
    input.preferredPowerUp !== 0 &&
    input.preferredPowerUp === input.heldPowerUp &&
    input.powerUpLevel >>> 0 < input.preferredLevel >>> 0
  ) {
    return getDecision(position, PowerUpUseDecision.WAIT)
  }
  const chanceIndex = CHANCE_INDEX_BY_POWER_UP[input.heldPowerUp]
  if (chanceIndex === undefined || chanceIndex < 0) {
    return getDecision(position, PowerUpUseDecision.KEEP)
  }
  if (input.heldPowerUp === 1 && !input.isTargetAhead) {
    return getDecision(position, PowerUpUseDecision.KEEP)
  }
  const draw = drawRandomLowByte(table, position)
  if (draw.value >= (input.personality.chances[chanceIndex] ?? 0)) {
    return getDecision(draw.position, PowerUpUseDecision.WAIT)
  }
  if (input.heldPowerUp === 3) {
    const isHeldByLevel =
      (input.racerFlags & RACER_POWER_UP_THREE_HOLD_FLAG) !== 0 &&
      input.powerUpLevel === POWER_UP_THREE_HOLD_LEVEL
    if (isHeldByLevel || (input.carBodyFlags & CAR_BODY_POWER_UP_THREE_HOLD_FLAG) !== 0) {
      return getDecision(draw.position, PowerUpUseDecision.KEEP)
    }
  }
  return getDecision(draw.position, PowerUpUseDecision.USE)
}

// 0x004377f0, start: every racer counts up racer +0xcd8; past the interval it restarts at 150 ms and a
// computer racer (racer +0xd08 == 2) holding a power-up runs 0x00438f20, whose WAIT makes it 1,000 ms.
export const updatePowerUpUse = (
  table: RandomTable,
  position: RandomTablePosition,
  schedule: PowerUpUseSchedule,
  stepMilliseconds: number,
  isComputer: boolean,
  input: PowerUpUseInput
): PowerUpUseStep => {
  const elapsed = (schedule.elapsedMilliseconds + stepMilliseconds) >>> 0
  if (elapsed <= schedule.intervalMilliseconds >>> 0) {
    return Object.freeze({
      position,
      schedule: Object.freeze({ ...schedule, elapsedMilliseconds: elapsed }),
      decision: null,
    })
  }
  if (!isComputer || input.heldPowerUp === 0) {
    return Object.freeze({
      position,
      schedule: Object.freeze({
        elapsedMilliseconds: 0,
        intervalMilliseconds: POWER_UP_CHECK_INTERVAL_MILLISECONDS,
      }),
      decision: null,
    })
  }
  const result = decidePowerUpUse(table, position, input)
  return Object.freeze({
    position: result.position,
    schedule: Object.freeze({
      elapsedMilliseconds: 0,
      intervalMilliseconds:
        result.decision === PowerUpUseDecision.WAIT
          ? POWER_UP_WAIT_MILLISECONDS
          : POWER_UP_CHECK_INTERVAL_MILLISECONDS,
    }),
    decision: result.decision,
  })
}
