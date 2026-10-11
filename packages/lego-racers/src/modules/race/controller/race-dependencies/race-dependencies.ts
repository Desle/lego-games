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
  createCollideRacers,
  endCarBodyEffect,
  endTimedEffect,
  followDriverRoute,
  getRacer,
  getRacerSphere,
  keepRacerSetNotYetPorted,
  transferTimedEffect,
  updateVehicle,
} from '../../../racer/index.ts'
import type {
  RacerBoundary,
  RacerPassDependencies,
  RacerSetBoundary,
  RacerSetContext,
  PlayerControllerDependencies,
  RacerSetStepDependencies,
} from '../../../racer/index.ts'
import { getSpheresOverlap } from '../../../racer-collision/index.ts'
import { runTrackLogic, tickTrackTimeEntries } from '../../../track-logic/index.ts'
import {
  getRacerAfterTargetGuidance,
  getRacerAfterWrongWayCheck,
} from '../../types/player-guidance/player-guidance.ts'
import { getRacerAfterCheckpointContact } from '../../types/checkpoint-touch/checkpoint-touch.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'
import { PLAYER_CONTROLLER } from '../../types/racer-transitions/racer-transitions.ts'
import {
  changePowerUps,
  changeRacer,
  changeTrackLogic,
  getRaceRacerSetOf,
  getRacerSetInZone,
  NO_RACE_CONTACTS,
} from '../race-world/race-world.ts'
import {
  separateFreeRacerBody,
  separateScriptedRacerBody,
  stepRacerRigidBodyWithContacts,
  stepRacerScriptWithContacts,
} from '../racer-contacts/racer-contacts.ts'
import { getRegistryEntries, getRegistrySphere } from '../registry-objects/registry-objects.ts'

const RACER_PERMANENT_TURBO_FLAG = 0x8000000
const RACER_TUMBLING_FLAG = 0x8

// The calls the racer collision response (0x00438560) makes into code that is not ported.
const RACE_COLLISION_DEPENDENCIES: RacerPassDependencies = Object.freeze({
  // 0x0043d270's precise test, slot 6 of the racer's sphere against the registered object's sphere (0x00411b90).
  getIsTouchingRegistryEntry: (context, racerSet, racerIndex, entry) => {
    const raced = getRaceRacerSetOf(racerSet)
    const object = raced.registryObjects[entry.id]
    return (
      object !== undefined &&
      getSpheresOverlap(
        context.arithmetic,
        getRacerSphere(context, getRacer(raced, racerIndex)),
        getRegistrySphere(raced, object)
      )
    )
  },
  separateScriptedCarBody: separateScriptedRacerBody,
  separateFreeCarBody: separateFreeRacerBody,
  transferTimedEffect,
  endTimedEffect,
})

const collideRegisteredRacers = createCollideRacers(RACE_COLLISION_DEPENDENCIES)

// The registry's answer to the racers it found touching an object (0x004408e0's callbacks): a trigger fires its
// events (0x00463c70, 0x00464f40), a brick is collected (0x00453af0).
const answerRegistryContacts = (context: RacerSetContext, racerSet: RaceRacerSet): RaceRacerSet =>
  racerSet.registryContacts.reduce((current, contact) => {
    const object = current.registryObjects[contact.id]
    const racer = current.racers[contact.racer]
    if (object === undefined || racer === undefined) return current
    if (object.type === 'main_trigger' || object.type === 'environment_trigger') {
      const isMain = object.type === 'main_trigger'
      return changeTrackLogic(context, current, (trackLogic, trackContext) =>
        runTrackLogic(trackLogic, trackContext, (session) =>
          session.touchTrigger({
            isMain,
            triggerIndex: object.index,
            racer: isMain ? { index: contact.racer, currentLap: racer.currentLap } : null,
          })
        )
      )
    }
    const brickContacts = [{ racer: contact.racer, brick: object.index }]
    return changePowerUps(context, current, (step, powerUpContext) =>
      object.type === 'power_up_brick'
        ? touchPowerUpBricks(step, powerUpContext, brickContacts)
        : touchEnhancementBricks(step, powerUpContext, brickContacts)
    )
  }, racerSet)

// Pass 4: the collision manager (racer set +0xf0, 0x0043d180): the registry's time list runs the timers' callbacks
// (0x0042fce0), the racers sort and meet (0x0043aca0, 0x0043ab90) and then touch the registered objects
// (0x0043d270). What a caller delivers as RaceContacts is applied first.
const deliverContacts: RacerSetBoundary = (context, racerSet, stepMilliseconds) => {
  const raced = changeTrackLogic(context, getRaceRacerSetOf(racerSet), (trackLogic, trackContext) =>
    tickTrackTimeEntries(trackLogic, trackContext, stepMilliseconds)
  )
  const { checkpointTouches, zoneCrossings, brickContacts, enhancementBrickContacts } =
    raced.pendingContacts
  const touched = checkpointTouches.reduce(
    (current, touch) =>
      changeRacer(current, touch.racerIndex, (racer) =>
        getRacerAfterCheckpointContact(
          context.arithmetic,
          context.checkpoints,
          racer,
          touch.checkpointIndex,
          touch.direction
        )
      ),
    raced
  )
  const zoned = zoneCrossings.reduce(
    (current, crossing) => getRacerSetInZone(current, crossing.racerIndex, crossing.zone),
    touched
  )
  const bricked = changePowerUps(context, zoned, (step, powerUpContext) =>
    touchEnhancementBricks(
      touchPowerUpBricks(step, powerUpContext, brickContacts),
      powerUpContext,
      enhancementBrickContacts
    )
  )
  const refreshed: RaceRacerSet = Object.freeze({
    ...bricked,
    pendingContacts: NO_RACE_CONTACTS,
    registryEntries: getRegistryEntries(context.arithmetic, bricked, bricked.registryEntries),
  })
  return answerRegistryContacts(
    context,
    getRaceRacerSetOf(collideRegisteredRacers(context, refreshed, stepMilliseconds))
  )
}

// Pass 7: 0x00438f20 for a computer racer holding a power-up (the racer module has already moved the timers).
const considerPowerUp: RacerBoundary = (context, racerSet, racerIndex, stepMilliseconds) => {
  const raced = getRaceRacerSetOf(racerSet)
  const setup = raced.powerUpSetups[racerIndex]
  if (setup === undefined) return raced
  const zeroed = changeRacer(raced, racerIndex, (racer) =>
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

// Pass 7: 0x00439cf0 and 0x00439ea0 for player racers (the target is the one a trigger's event set, racer +0xdf8).
const guidePlayer: RacerBoundary = (context, racerSet, racerIndex, stepMilliseconds) =>
  changeRacer(getRaceRacerSetOf(racerSet), racerIndex, (racer) =>
    racer.controllerKind === PLAYER_CONTROLLER
      ? getRacerAfterTargetGuidance(
          context.arithmetic,
          getRacerAfterWrongWayCheck(
            { arithmetic: context.arithmetic, checkpoints: context.checkpoints, stepMilliseconds },
            racer
          ),
          racer.guidanceTarget
        )
      : racer
  )

// RacerSetStepDependencies for a race. Wired: the car rigid body and the scripted car body with the car body's contact
// filter and surface values, the collision manager with the registry (triggers and bricks), the computer's power-up
// use and the permanent turbo, the player's wrong-way warning, the driver's route following 0x004203b0, the vehicle
// 0x0043e070, the timed effect and the car body effect. Audio and presentation (sounds, camera, effects) keep the
// racer's stand-in. Still stubs: the taunt 0x00439c90 and the contact sound.
export const RACE_STEP_DEPENDENCIES: RacerSetStepDependencies = Object.freeze({
  followDriverRoute,
  stepRigidBody: stepRacerRigidBodyWithContacts,
  stepScriptedCarBody: stepRacerScriptWithContacts,
  updateEngineSound: keepRacerSetNotYetPorted,
  endPowerSlideEffects: keepRacerSetNotYetPorted,
  collideRacers: deliverContacts,
  updateVehicle,
  updateRacerSounds: keepRacerSetNotYetPorted,
  considerComputerPowerUp: considerPowerUp,
  endCarBodyEffect,
  endTimedEffect,
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
