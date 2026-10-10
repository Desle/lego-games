import { BrickKind } from '../../types/brick-kind/brick-kind.ts'
import type { RacerPowerUpAbilities } from '../../types/power-ups.types.ts'
import { activatePowerUp } from '../activate-power-up/activate-power-up.ts'
import {
  getRacer,
  getStepWithEvents,
  getStepWithRacer,
  getStepWithReleasedEnhancements,
  getStepWithVoice,
} from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'

const MAXIMUM_LEVEL = 3

// 0x00439100: the human's fire button (0x00430620) and the computer's decision (0x00438f20) both end here.
export const usePowerUp = (
  step: PowerUpStep,
  context: PowerUpContext,
  racerIndex: number,
  abilities: RacerPowerUpAbilities
): PowerUpStep => {
  const racer = getRacer(step, racerIndex)
  if (racer.heldBrickKind === null) {
    return getStepWithEvents(step, [{ type: 'power_ups.horn', racer: racerIndex }])
  }
  const level = abilities.isAlwaysLevelThree ? MAXIMUM_LEVEL : racer.enhancementLevel
  const activated = ((): PowerUpStep => {
    if (abilities.isAlwaysGrapple) {
      return activatePowerUp(step, context, racerIndex, {
        category: BrickKind.PROJECTILE,
        level: 1,
      })
    }
    switch (racer.heldBrickKind) {
      case BrickKind.PROJECTILE:
        return activatePowerUp(step, context, racerIndex, { category: BrickKind.PROJECTILE, level })
      case BrickKind.TURBO:
        // A racer with the permanent turbo only uses turbo bricks at level 3; the brick is spent either way.
        return abilities.isPermanentTurbo && level !== MAXIMUM_LEVEL
          ? step
          : activatePowerUp(step, context, racerIndex, { category: BrickKind.TURBO, level })
      default:
        // Shield and hazard: a taunt first (0x00439240 with 1).
        return activatePowerUp(getStepWithVoice(step, racerIndex, true), context, racerIndex, {
          category: racer.heldBrickKind,
          level,
        })
    }
  })()
  const spent = getStepWithRacer(activated, racerIndex, {
    ...getRacer(activated, racerIndex),
    heldBrickKind: null,
  })
  return getStepWithReleasedEnhancements(spent, racerIndex)
}
