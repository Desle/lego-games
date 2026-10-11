import {
  activatePowerUp,
  advanceComputerPowerUpUse,
  BrickKind,
  keepPermanentTurbo,
  touchEnhancementBricks,
  touchPowerUpBricks,
  usePowerUp,
} from '../../../power-ups/index.ts'
import {
  getRacer,
  keepRacerSetNotYetPorted,
  setRacer,
  stepRacerRigidBody,
} from '../../../racer/index.ts'
import type {
  Racer,
  RacerBoundary,
  RacerSetBoundary,
  PlayerControllerDependencies,
  RacerSetStepDependencies,
} from '../../../racer/index.ts'
import {
  getRacerAfterTargetGuidance,
  getRacerAfterWrongWayCheck,
} from '../../types/player-guidance/player-guidance.ts'
import { getLapGapMilliseconds } from '../../types/lap-gap/lap-gap.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'
import {
  enterZoneOne,
  enterZoneTwo,
  enterZoneZero,
  getRacerAfterCheckpointTouch,
  PLAYER_CONTROLLER,
} from '../../types/racer-transitions/racer-transitions.ts'
import { stepScriptedCarBody } from '../../types/scripted-car-body/scripted-car-body.ts'
import { tickTrackTimeEntries } from '../../../track-logic/index.ts'
import {
  changePowerUps,
  changeTrackLogic,
  getRaceRacerSetOf,
  NO_RACE_CONTACTS,
} from '../race-world/race-world.ts'

const ZONE_ZERO = 0
const ZONE_ONE = 1
const RACER_PERMANENT_TURBO_FLAG = 0x8000000
const RACER_TUMBLING_FLAG = 0x8

const updateRacerAt = (
  racerSet: RaceRacerSet,
  racerIndex: number,
  change: (racer: Racer) => Racer
): RaceRacerSet =>
  getRaceRacerSetOf(setRacer(racerSet, racerIndex, change(getRacer(racerSet, racerIndex))))

// Pass 2: CarBody_Update 0x004293f0 for a body that follows a script, which runs 0x00429d40.
const stepRacerScript: RacerBoundary = (context, racerSet, racerIndex, stepMilliseconds) =>
  updateRacerAt(getRaceRacerSetOf(racerSet), racerIndex, (racer) =>
    Object.freeze({
      ...racer,
      carBody: stepScriptedCarBody(context.arithmetic, racer.carBody, stepMilliseconds),
    })
  )

// Pass 4: what the collision registry (racer set +0xf0) and the rigid bodies' contacts report is delivered here,
// once per frame (the registry itself, 0x0043d180, is not ported).
const deliverContacts: RacerSetBoundary = (context, racerSet, stepMilliseconds) => {
  // The registry's time list runs first (0x0042fce0 → 0x0042fc10): the timers' callbacks.
  const raced = changeTrackLogic(context, getRaceRacerSetOf(racerSet), (trackLogic, trackContext) =>
    tickTrackTimeEntries(trackLogic, trackContext, stepMilliseconds)
  )
  const { checkpointTouches, zoneCrossings, brickContacts, enhancementBrickContacts } =
    raced.pendingContacts
  const touched = checkpointTouches.reduce((current, touch) => {
    const checkpoint = context.checkpoints[touch.checkpointIndex]
    if (checkpoint === undefined) return current
    // 0x00439fc0: the contact's vector against the plane normal, (z + y) + x, side 1 when it is not below 0.
    const { add, multiply, getIsBelow } = context.arithmetic
    const [normalX, normalY, normalZ] = checkpoint.plane
    const dot = add(
      add(multiply(touch.direction.z, normalZ), multiply(touch.direction.y, normalY)),
      multiply(touch.direction.x, normalX)
    )
    const side = getIsBelow(dot, 0) ? 0 : 1
    return updateRacerAt(current, touch.racerIndex, (racer) =>
      getRacerAfterCheckpointTouch(
        racer,
        touch.checkpointIndex,
        context.arithmetic.getIsEqual(checkpoint.progress, 0),
        side
      )
    )
  }, raced)
  const zoned = zoneCrossings.reduce(
    (current, crossing) =>
      updateRacerAt(current, crossing.racerIndex, (racer) => {
        if (crossing.zone === ZONE_ZERO) return enterZoneZero(racer)
        if (crossing.zone === ZONE_ONE) {
          return enterZoneOne(racer, (next) =>
            getLapGapMilliseconds(
              setRacer(current, crossing.racerIndex, next),
              crossing.racerIndex,
              next.lapCount
            )
          )
        }
        return enterZoneTwo(racer)
      }),
    touched
  )
  const bricked = changePowerUps(context, zoned, (step, powerUpContext) =>
    touchEnhancementBricks(
      touchPowerUpBricks(step, powerUpContext, brickContacts),
      powerUpContext,
      enhancementBrickContacts
    )
  )
  return Object.freeze({ ...bricked, pendingContacts: NO_RACE_CONTACTS })
}

// Pass 7: 0x00438f20 for a computer racer holding a power-up (the racer module has already moved the timers).
const considerPowerUp: RacerBoundary = (context, racerSet, racerIndex, stepMilliseconds) => {
  const raced = getRaceRacerSetOf(racerSet)
  const setup = raced.powerUpSetups[racerIndex]
  if (setup === undefined) return raced
  const zeroed = updateRacerAt(raced, racerIndex, (racer) =>
    Object.freeze({ ...racer, powerUpThinkMilliseconds: 0, powerUpThinkIntervalMilliseconds: 0 })
  )
  return changePowerUps(context, zeroed, (step, powerUpContext) =>
    advanceComputerPowerUpUse(
      step,
      powerUpContext,
      racerIndex,
      setup.personality,
      setup.abilities,
      stepMilliseconds
    )
  )
}

// Pass 7: 0x0045b1e0 (turbo level 2) for a racer with the permanent turbo (+0xd04 0x8000000), not tumbling.
const keepTurbo: RacerBoundary = (context, racerSet, racerIndex) => {
  const raced = getRaceRacerSetOf(racerSet)
  const setup = raced.powerUpSetups[racerIndex]
  if (setup === undefined) return raced
  const racer = getRacer(raced, racerIndex)
  const abilities = {
    ...setup.abilities,
    isPermanentTurbo: (racer.flags & RACER_PERMANENT_TURBO_FLAG) !== 0,
  }
  return (racer.flags & RACER_TUMBLING_FLAG) !== 0
    ? raced
    : changePowerUps(context, raced, (step, powerUpContext) =>
        keepPermanentTurbo(step, powerUpContext, racerIndex, abilities)
      )
}

// Pass 7: 0x00439cf0 and 0x00439ea0 for player racers.
const guidePlayer: RacerBoundary = (context, racerSet, racerIndex, stepMilliseconds) =>
  updateRacerAt(getRaceRacerSetOf(racerSet), racerIndex, (racer) =>
    racer.controllerKind === PLAYER_CONTROLLER
      ? getRacerAfterTargetGuidance(
          context.arithmetic,
          getRacerAfterWrongWayCheck(
            { arithmetic: context.arithmetic, checkpoints: context.checkpoints, stepMilliseconds },
            racer
          ),
          null
        )
      : racer
  )

// RacerSetStepDependencies for a race. Wired: the car rigid body, the scripted car body, the contacts a frame
// delivers, the computer's power-up use and the permanent turbo, the player's wrong-way warning. Audio and
// presentation (sounds, camera, effects) keep the racer's stand-in. Still stubs: the driver's route following
// 0x004203b0, racer-against-racer collisions, Vehicle_Update 0x0043e070 (it moves the random cursor), the
// car body effect 0x004397b0, the end of the curse 0x00439b00, the taunt 0x00439c90 and the contact sound.
export const RACE_STEP_DEPENDENCIES: RacerSetStepDependencies = Object.freeze({
  followDriverRoute: keepRacerSetNotYetPorted,
  stepRigidBody: stepRacerRigidBody,
  stepScriptedCarBody: stepRacerScript,
  updateEngineSound: keepRacerSetNotYetPorted,
  endPowerSlideEffects: keepRacerSetNotYetPorted,
  collideRacers: deliverContacts,
  updateVehicle: keepRacerSetNotYetPorted,
  updateRacerSounds: keepRacerSetNotYetPorted,
  considerComputerPowerUp: considerPowerUp,
  endCarBodyEffect: keepRacerSetNotYetPorted,
  endTimedEffect: keepRacerSetNotYetPorted,
  tauntNearestRacer: keepRacerSetNotYetPorted,
  updatePlayerGuidance: guidePlayer,
  notifyRacerContact: keepRacerSetNotYetPorted,
  triggerPowerUpEffect: keepTurbo,
  updateNearestRacerSound: keepRacerSetNotYetPorted,
})

// Binding 4: 0x00439100 uses the held power-up.
const useHeldPowerUp: RacerBoundary = (context, racerSet, racerIndex) => {
  const raced = getRaceRacerSetOf(racerSet)
  const setup = raced.powerUpSetups[racerIndex]
  if (setup === undefined) return raced
  return changePowerUps(context, raced, (step, powerUpContext) =>
    usePowerUp(step, powerUpContext, racerIndex, setup.abilities)
  )
}

// 0x00430790 and 0x00430710: the start boost is a level 0 turbo, or level 1 when it was held for over 59 ms.
const triggerStartBoost: PlayerControllerDependencies['triggerStartBoost'] = (
  context,
  racerSet,
  racerIndex,
  isStrongBoost
) =>
  changePowerUps(context, getRaceRacerSetOf(racerSet), (step, powerUpContext) =>
    activatePowerUp(step, powerUpContext, racerIndex, {
      category: BrickKind.TURBO,
      level: isStrongBoost ? 1 : 0,
    })
  )

// The player controller's calls into the rest of the race. The camera, the HUD and the sound and smoke of a
// power slide are presentation and keep the racer's stand-in.
export const RACE_PLAYER_CONTROLLER_DEPENDENCIES: PlayerControllerDependencies = Object.freeze({
  usePowerUp: useHeldPowerUp,
  changeCamera: keepRacerSetNotYetPorted,
  changeHudMode: keepRacerSetNotYetPorted,
  setLookBehind: (_context, racerSet) => racerSet,
  triggerStartBoost,
  startPowerSlideEffects: keepRacerSetNotYetPorted,
  endPowerSlideEffects: keepRacerSetNotYetPorted,
})
