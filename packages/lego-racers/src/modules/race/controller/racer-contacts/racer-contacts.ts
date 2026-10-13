import { runTrackLogic } from '../../../track-logic/index.ts'
import type { TrackSession } from '../../../track-logic/index.ts'
import { moveOutOfContact, stepCarRigidBody } from '../../../racer-physics/index.ts'
import type { CarRigidBodyHooks } from '../../../racer-physics/index.ts'
import {
  clearVehicleWheelEmitter,
  getRacer,
  getRacerCollisionObjects,
  setRacer,
  setVehicleWheelEmitter,
} from '../../../racer/index.ts'
import type {
  CarBody,
  Racer,
  RacerBoundary,
  RacerSetContext,
  RacerSet,
} from '../../../racer/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { createCarBodyContactHooks } from '../../types/car-body-contacts/car-body-contacts.ts'
import { getRacerAfterCheckpointContact } from '../../types/checkpoint-touch/checkpoint-touch.ts'
import {
  getScriptedBodySeparated,
  stepScriptedCarBody,
} from '../../types/scripted-car-body/scripted-car-body.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'
import type { CarBodyContact } from '../../types/surface-materials/surface-materials.types.ts'
import { COMPUTER_CONTROLLER } from '../../types/racer-transitions/racer-transitions.ts'
import { changeRacer, changeTrackLogic, getRaceRacerSetOf } from '../race-world/race-world.ts'

const getPoint = (vector: Vector3): readonly [number, number, number] => [
  vector.x,
  vector.y,
  vector.z,
]

const runSurfaceSignals = (
  context: RacerSetContext,
  racerSet: RaceRacerSet,
  run: (session: TrackSession) => void
): RaceRacerSet =>
  changeTrackLogic(context, racerSet, (trackLogic, trackContext) =>
    runTrackLogic(trackLogic, trackContext, run)
  )

// Car body 0x0042af90, 0x0042b060 and the end of 0x004293f0: the loop of the surface sound (key and the return
// address of its RaceSounds_Get), kept while the car runs on the ground faster than 0.009 and is not tumbling.
const SURFACE_SOUND_ADDRESS = '0x0042b007'
// 0x004293f0
const TUMBLING_BODY_FLAG = 0x8
// 0x004b0474
const SURFACE_SOUND_MINIMUM_SPEED = getFloatFromBits(0x3c1374bc)

const getSurfaceSoundKey = (racerIndex: number) => `surface:${String(racerIndex)}`

const getRacerSetWithLoop = (
  racerSet: RaceRacerSet,
  loop: RaceRacerSet['loopedSounds'][number]
): RaceRacerSet =>
  Object.freeze({ ...racerSet, loopedSounds: Object.freeze([...racerSet.loopedSounds, loop]) })

// 0x0042b060: the surface sound stops.
const getRacerSetWithSurfaceSoundStopped = (
  racerSet: RaceRacerSet,
  racerIndex: number
): RaceRacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  if (racer.surfaceSound === null) return racerSet
  return getRacerSetWithLoop(
    getRaceRacerSetOf(
      setRacer(racerSet, racerIndex, Object.freeze({ ...racer, surfaceSound: null }))
    ),
    {
      isStart: false,
      key: getSurfaceSoundKey(racerIndex),
      soundId: racer.surfaceSound.soundId,
      address: '0x0042b060',
      racerIndex,
    }
  )
}

// 0x0042af90: a sound that is playing already stays; another replaces it.
const getRacerSetWithSurfaceSound = (
  racerSet: RaceRacerSet,
  racerIndex: number,
  soundId: number
): RaceRacerSet => {
  if (getRacer(racerSet, racerIndex).surfaceSound?.soundId === soundId) return racerSet
  const stopped = getRacerSetWithSurfaceSoundStopped(racerSet, racerIndex)
  const racer = getRacer(stopped, racerIndex)
  return getRacerSetWithLoop(
    getRaceRacerSetOf(
      setRacer(
        stopped,
        racerIndex,
        Object.freeze({ ...racer, surfaceSound: { soundId, milliseconds: 0 } })
      )
    ),
    {
      isStart: true,
      key: getSurfaceSoundKey(racerIndex),
      soundId,
      address: SURFACE_SOUND_ADDRESS,
      racerIndex,
    }
  )
}

// 0x004293f0 after the step: the sound keeps running (and its clock counts) while a wheel is on the ground, the car
// is not tumbling and its speed is at least 0.009 either way; otherwise it stops.
const getRacerSetAfterSurfaceSoundUpdate = (
  racerSet: RaceRacerSet,
  racerIndex: number,
  stepMilliseconds: number
): RaceRacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  const { surfaceSound } = racer
  if (surfaceSound === null) return racerSet
  const { groundedWheelCount, flags, speed } = racer.carBody.rigidBody
  const isRunning =
    groundedWheelCount !== 0 &&
    (flags & TUMBLING_BODY_FLAG) === 0 &&
    (speed >= SURFACE_SOUND_MINIMUM_SPEED || speed <= -SURFACE_SOUND_MINIMUM_SPEED)
  if (!isRunning) return getRacerSetWithSurfaceSoundStopped(racerSet, racerIndex)
  return getRaceRacerSetOf(
    setRacer(
      racerSet,
      racerIndex,
      Object.freeze({
        ...racer,
        surfaceSound: {
          soundId: surfaceSound.soundId,
          milliseconds: surfaceSound.milliseconds + stepMilliseconds,
        },
      })
    )
  )
}

// What the car body's contact filter (0x0042a830) and its wheels' surface walk (0x0042a900) did, applied in the
// order they happened: a touched checkpoint (0x00439fc0), the finish object (racer +0xce4 = +0xce0), and the events
// of surfaces (0x00462580 with 0x00462ae0 for a wall, 0x00461ef0 with 0x004628c0 for a wheel entering, 0x00462140
// with 0x004629d0 for a wheel leaving).
export const applyCarBodyContacts = (
  context: RacerSetContext,
  racerSet: RaceRacerSet,
  racerIndex: number,
  contacts: readonly CarBodyContact[]
): RaceRacerSet =>
  contacts.reduce((current, contact) => {
    switch (contact.type) {
      case 'checkpoint_touched':
        return changeRacer(current, racerIndex, (racer) =>
          getRacerAfterCheckpointContact(
            context.arithmetic,
            context.checkpoints,
            racer,
            contact.checkpointIndex,
            contact.direction
          )
        )
      case 'finish_touched':
        return changeRacer(current, racerIndex, (racer) =>
          Object.freeze({ ...racer, currentLap: racer.lapCount })
        )
      case 'surface_hit':
        return runSurfaceSignals(context, current, (session) => {
          session.startStopSignal(contact.identifier, contact.identifier, getPoint(contact.point))
          session.fireReleaseTrigger(contact.identifier, contact.identifier, racerIndex)
        })
      case 'surface_entered':
        return runSurfaceSignals(context, current, (session) => {
          session.startSignal(contact.identifier, getPoint(contact.position))
          session.fireTrigger(contact.identifier, racerIndex)
        })
      case 'surface_left':
        return runSurfaceSignals(context, current, (session) => {
          session.stopSignal(contact.identifier, getPoint(contact.position))
          session.releaseTrigger(contact.identifier, racerIndex)
        })
      case 'wheel_emitter_started':
        return getRaceRacerSetOf(
          setVehicleWheelEmitter(context, current, racerIndex, contact.wheelIndex, contact.name)
        )
      case 'wheel_emitter_stopped':
        return getRaceRacerSetOf(clearVehicleWheelEmitter(current, racerIndex, contact.wheelIndex))
      case 'wheel_surface_sound':
        return getRacerSetWithSurfaceSound(current, racerIndex, contact.soundId)
      case 'wheel_surface_left':
        return getRacer(current, racerIndex).surfaceSound?.soundId === contact.soundId
          ? getRacerSetWithSurfaceSoundStopped(current, racerIndex)
          : current
      default:
        return current
    }
  }, racerSet)

const stepRacerBodyWithContacts = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  stepMilliseconds: number,
  getSteppedCarBody: (racer: Racer, hooks: CarRigidBodyHooks) => CarBody
): RacerSet => {
  const raced = getRaceRacerSetOf(racerSet)
  const racer = getRacer(raced, racerIndex)
  const contacts: CarBodyContact[] = []
  const carBody = getSteppedCarBody(
    racer,
    createCarBodyContactHooks(raced.surfaces, (contact) => void contacts.push(contact), {
      isComputer: racer.controllerKind === COMPUTER_CONTROLLER,
    })
  )
  const stepped = getRaceRacerSetOf(
    setRacer(raced, racerIndex, Object.freeze({ ...racer, carBody }))
  )
  return getRacerSetAfterSurfaceSoundUpdate(
    applyCarBodyContacts(context, stepped, racerIndex, contacts),
    racerIndex,
    stepMilliseconds
  )
}

// Pass 2, CarBody_Update 0x004293f0 → RigidBody_Step 0x00444ef0 with the car body's own contact filter and surface
// walk (vtable 0x004b04e4 slots +0x0c and +0x10).
export const stepRacerRigidBodyWithContacts: RacerBoundary = (
  context,
  racerSet,
  racerIndex,
  stepMilliseconds
) =>
  stepRacerBodyWithContacts(context, racerSet, racerIndex, stepMilliseconds, (racer, hooks) =>
    Object.freeze({
      ...racer.carBody,
      rigidBody: stepCarRigidBody(
        context.arithmetic,
        racer.carBody.rigidBody,
        { stepMilliseconds, collisionObjects: getRacerCollisionObjects(context, racer) },
        hooks
      ),
    })
  )

// Pass 2, CarBody_Update → CarBody_StepOnRoute 0x00429d40 for a computer racer's scripted body: its hull points
// still run against the checkpoint object, so it touches checkpoints like a car.
export const stepRacerScriptWithContacts: RacerBoundary = (
  context,
  racerSet,
  racerIndex,
  stepMilliseconds
) =>
  stepRacerBodyWithContacts(context, racerSet, racerIndex, stepMilliseconds, (racer, hooks) =>
    stepScriptedCarBody(
      context.arithmetic,
      racer.carBody,
      { stepMilliseconds, collisionObjects: getRacerCollisionObjects(context, racer) },
      hooks
    )
  )

// 0x00429680 on a scripted body: the route follower is moved by the displacement (0x004a5750).
export const separateScriptedRacerBody = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  displacement: Vector3
): RacerSet => {
  const raced = getRaceRacerSetOf(racerSet)
  return changeRacer(raced, racerIndex, (racer) =>
    Object.freeze({
      ...racer,
      carBody: getScriptedBodySeparated(context.arithmetic, racer.carBody, displacement),
    })
  )
}

// 0x00429680 on a free body is 0x004490b0: the body moves out of contact, with the car body's contact filter.
export const separateFreeRacerBody = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  displacement: Vector3
): RacerSet => {
  const raced = getRaceRacerSetOf(racerSet)
  const racer = getRacer(raced, racerIndex)
  const contacts: CarBodyContact[] = []
  const rigidBody = moveOutOfContact(
    context.arithmetic,
    racer.carBody.rigidBody,
    displacement,
    getRacerCollisionObjects(context, racer),
    createCarBodyContactHooks(raced.surfaces, (contact) => void contacts.push(contact))
  )
  const moved = getRaceRacerSetOf(
    setRacer(
      raced,
      racerIndex,
      Object.freeze({ ...racer, carBody: Object.freeze({ ...racer.carBody, rigidBody }) })
    )
  )
  return applyCarBodyContacts(context, moved, racerIndex, contacts)
}
