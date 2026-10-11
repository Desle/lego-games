import { runTrackLogic } from '../../../track-logic/index.ts'
import type { TrackSession } from '../../../track-logic/index.ts'
import { stepCarRigidBody } from '../../../racer-physics/index.ts'
import { getRacer, setRacer } from '../../../racer/index.ts'
import type { RacerBoundary, RacerSetContext } from '../../../racer/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { createCarBodyContactHooks } from '../../types/car-body-contacts/car-body-contacts.ts'
import { getRacerAfterCheckpointContact } from '../../types/checkpoint-touch/checkpoint-touch.ts'
import { stepScriptedCarBody } from '../../types/scripted-car-body/scripted-car-body.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'
import type { CarBodyContact } from '../../types/surface-materials/surface-materials.types.ts'
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
      default:
        return current
    }
  }, racerSet)

// Pass 2, CarBody_Update 0x004293f0 → RigidBody_Step 0x00444ef0 with the car body's own contact filter and surface
// walk (vtable 0x004b04e4 slots +0x0c and +0x10).
export const stepRacerRigidBodyWithContacts: RacerBoundary = (
  context,
  racerSet,
  racerIndex,
  stepMilliseconds
) => {
  const raced = getRaceRacerSetOf(racerSet)
  const racer = getRacer(raced, racerIndex)
  const contacts: CarBodyContact[] = []
  const rigidBody = stepCarRigidBody(
    context.arithmetic,
    racer.carBody.rigidBody,
    { stepMilliseconds, collisionObjects: context.collisionObjects },
    createCarBodyContactHooks(raced.surfaces, (contact) => void contacts.push(contact))
  )
  const stepped = getRaceRacerSetOf(
    setRacer(
      raced,
      racerIndex,
      Object.freeze({ ...racer, carBody: Object.freeze({ ...racer.carBody, rigidBody }) })
    )
  )
  return applyCarBodyContacts(context, stepped, racerIndex, contacts)
}

// Pass 2, CarBody_Update → CarBody_StepOnRoute 0x00429d40 for a computer racer's scripted body: its hull points
// still run against the checkpoint object, so it touches checkpoints like a car.
export const stepRacerScriptWithContacts: RacerBoundary = (
  context,
  racerSet,
  racerIndex,
  stepMilliseconds
) => {
  const raced = getRaceRacerSetOf(racerSet)
  const racer = getRacer(raced, racerIndex)
  const contacts: CarBodyContact[] = []
  const carBody = stepScriptedCarBody(
    context.arithmetic,
    racer.carBody,
    { stepMilliseconds, collisionObjects: context.collisionObjects },
    createCarBodyContactHooks(raced.surfaces, (contact) => void contacts.push(contact))
  )
  const stepped = getRaceRacerSetOf(
    setRacer(raced, racerIndex, Object.freeze({ ...racer, carBody }))
  )
  return applyCarBodyContacts(context, stepped, racerIndex, contacts)
}
