import { CAR_RIGID_BODY_HOOKS } from '../../../racer-physics/index.ts'
import type { CarRigidBody, CarRigidBodyHooks, CarWheel } from '../../../racer-physics/index.ts'
import { getFloatFromBits, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { TrackMaterial } from '../../../track-material/index.ts'
import { getIsDigitName, getTrackMaterial } from '../surface-materials/surface-materials.ts'
import type {
  CarBodyContact,
  CarBodyContactRecorder,
  SurfaceMaterials,
  WheelEmitterOptions,
} from '../surface-materials/surface-materials.types.ts'

// Bits of a track-material entry's flags (+0x08) that the car body reads; the keyword that sets each is in
// track-material.md.
const ENTRY_EVENT_FLAG = 0x2
const LEAVE_EVENT_FLAG = 0x4
const HIT_EVENT_FLAG = 0x8
const FORCE_FLAG = 0x40
const GRIP_FLAG = 0x800
const SKID_GRIP_FLAG = 0x1000
const WHEEL_GRIP_FLAG = 0x2000
const VALUE_FLAG = 0x4000
const DRAG_FLAG = 0x8000
const PASS_THROUGH_FLAG = 0x10000
const FINISH_FLAG = 0x40000
// Car body +0x6c0 bit 0x100000 (set for racers with racer flag 0x4000000): the surface's values are not used.
const SURFACE_IGNORED_BODY_FLAG = 0x100000

// The defaults 0x0042acb0 writes: DAT_004b0460, DAT_004b0464, DAT_004b0458 and DAT_004b045c.
const DEFAULT_GRIP = getFloatFromBits(0x3f000000)
const DEFAULT_SKID_GRIP = getFloatFromBits(0x3e800000)
const DEFAULT_WHEEL_GRIP = getFloatFromBits(0x40400000)
const DEFAULT_VALUE = getFloatFromBits(0x3f800000)

const getHasFlag = (property: TrackMaterial, flag: number): boolean => (property.flags & flag) !== 0

// 0x0042acb0 (without the vehicle's surface emitter and the force feedback, which are presentation).
const getWheelWithDefaultSurface = (wheel: CarWheel): CarWheel =>
  Object.freeze({
    ...wheel,
    surfaceDrag: 0,
    surfaceGrip: DEFAULT_GRIP,
    surfaceSkidGrip: DEFAULT_SKID_GRIP,
    grip: DEFAULT_WHEEL_GRIP,
    surfaceValue60: DEFAULT_VALUE,
    surfaceForce: ZERO_VECTOR3,
  })

// 0x0042aad0 (without the sound, the vehicle's emitter and the force feedback): a wheel on the ground takes the
// values of the material it stands on, each when the entry carries it.
const getWheelOnSurface = (
  wheel: CarWheel,
  property: TrackMaterial,
  isIgnored: boolean
): CarWheel => {
  if (!wheel.isOnGround) return getWheelWithDefaultSurface(wheel)
  const getIsUsed = (flag: number): boolean => getHasFlag(property, flag) && !isIgnored
  const [forceX, forceY, forceZ] = property.secondVector
  return Object.freeze({
    ...wheel,
    surfaceDrag: getIsUsed(DRAG_FLAG) ? property.fifthFloat : 0,
    surfaceGrip: getIsUsed(GRIP_FLAG) ? property.firstFloat : DEFAULT_GRIP,
    surfaceSkidGrip: getIsUsed(SKID_GRIP_FLAG) ? property.secondFloat : DEFAULT_SKID_GRIP,
    grip: getIsUsed(WHEEL_GRIP_FLAG) ? property.thirdFloat : DEFAULT_WHEEL_GRIP,
    surfaceValue60: getIsUsed(VALUE_FLAG) ? property.fourthFloat : DEFAULT_VALUE,
    surfaceForce: getIsUsed(FORCE_FLAG)
      ? Object.freeze({ x: forceX, y: forceY, z: forceZ })
      : ZERO_VECTOR3,
  })
}

// The speed above which a wheel's surface emitter runs (0x004b0468, 0.008) and the car body flags that stop it
// (0x8 and 0x80).
const WHEEL_EMITTER_MINIMUM_SPEED = getFloatFromBits(0x3c03126f)
const WHEEL_EMITTER_BLOCKING_BODY_FLAGS = 0x88
const EMITTER_NAME_FLAG = 0x400
// 0x0042aad0
const SURFACE_SOUND_FLAG = 0x80

// What a wheel asks of its vehicle's surface emitter: 0x0042aad0 starts the emitter the material names while the
// wheel is on the ground, the body goes faster than 0.008 and is neither in two-point mode nor flagged 0x80, and the
// racer is not a computer; every other case (and 0x0042acb0) stops it.
const getWheelEmitterContact = (
  body: CarRigidBody,
  wheelIndex: number,
  property: TrackMaterial | undefined,
  isComputer: boolean
): CarBodyContact => {
  const wheel = body.wheels[wheelIndex]
  const isStarted =
    property !== undefined &&
    wheel !== undefined &&
    wheel.isOnGround &&
    getHasFlag(property, EMITTER_NAME_FLAG) &&
    (body.flags & WHEEL_EMITTER_BLOCKING_BODY_FLAGS) === 0 &&
    WHEEL_EMITTER_MINIMUM_SPEED < body.forwardSpeed &&
    !isComputer
  return isStarted
    ? { type: 'wheel_emitter_started', wheelIndex, name: property.linkedName ?? '' }
    : { type: 'wheel_emitter_stopped', wheelIndex }
}

// 0x0042a900's walk over the wheels. A wheel whose material changed announces the new one (0x0042aa30) and the old
// one (0x0042aa70) unless another wheel is, or already was, on it.
const getBodyWithSurfaces = (
  body: CarRigidBody,
  surfaces: SurfaceMaterials,
  record: CarBodyContactRecorder,
  wheelEmitters: WheelEmitterOptions | undefined
): CarRigidBody => {
  const isIgnored = (body.flags & SURFACE_IGNORED_BODY_FLAG) !== 0
  const wheels = body.wheels.map((wheel, wheelIndex) => {
    const current = getTrackMaterial(surfaces, wheel.material)
    const previous = getTrackMaterial(surfaces, wheel.previousMaterial)
    if (wheelEmitters !== undefined) {
      record(getWheelEmitterContact(body, wheelIndex, current, wheelEmitters.isComputer))
    }
    if (
      current !== undefined &&
      wheel.isOnGround &&
      getHasFlag(current, SURFACE_SOUND_FLAG) &&
      wheelEmitters !== undefined
    ) {
      record({ type: 'wheel_surface_sound', soundId: current.fifthInteger })
    }
    const surfaced =
      current === undefined
        ? getWheelWithDefaultSurface(wheel)
        : getWheelOnSurface(wheel, current, isIgnored)
    if (wheel.material === wheel.previousMaterial) return surfaced
    if (current === undefined && previous === undefined) return surfaced
    let isEntering = current !== undefined
    let isLeaving = previous !== undefined
    body.wheels.forEach((other, otherIndex) => {
      if (otherIndex === wheelIndex) return
      if (
        wheel.material === other.previousMaterial ||
        (wheel.material === other.material && otherIndex < wheelIndex)
      ) {
        isEntering = false
      }
      if (
        wheel.previousMaterial === other.material ||
        (wheel.previousMaterial === other.previousMaterial && otherIndex < wheelIndex)
      ) {
        isLeaving = false
      }
    })
    if (
      isLeaving &&
      previous !== undefined &&
      getHasFlag(previous, SURFACE_SOUND_FLAG) &&
      wheelEmitters !== undefined
    ) {
      record({ type: 'wheel_surface_left', soundId: previous.fifthInteger })
    }
    if (isLeaving && previous !== undefined && getHasFlag(previous, LEAVE_EVENT_FLAG)) {
      record({
        type: 'surface_left',
        identifier: previous.secondInteger,
        position: wheel.anchor,
      })
    }
    if (isEntering && current !== undefined && getHasFlag(current, ENTRY_EVENT_FLAG)) {
      record({
        type: 'surface_entered',
        identifier: current.firstInteger,
        position: wheel.anchor,
      })
    }
    return surfaced
  })
  return Object.freeze({ ...body, wheels: Object.freeze(wheels) })
}

// The car body's overrides (vtable 0x004b04e4) of the car rigid body's slots +0x0c and +0x10: the hull contact
// filter 0x0042a830 and the wheels' surface values 0x0042a900. What they ask of the race (checkpoint touches, the
// finish object, the events of surfaces) goes to `record`; the sound of a surface (flag 0x80, 0x0042af90), the
// vehicle's surface emitter (0x0043dd50, 0x0043de90) and the force feedback (0x00421fe0) are presentation.
export const createCarBodyContactHooks = (
  surfaces: SurfaceMaterials,
  record: CarBodyContactRecorder,
  wheelEmitters?: WheelEmitterOptions
): CarRigidBodyHooks =>
  Object.freeze({
    ...CAR_RIGID_BODY_HOOKS,
    decideHullContact: (body, contact) => {
      const { material } = contact
      if (
        contact.collisionObjectIndex === surfaces.checkpointObjectIndex &&
        material !== undefined &&
        getIsDigitName(material)
      ) {
        const checkpointIndex = surfaces.checkpointIndices.get(material)
        if (checkpointIndex !== undefined) {
          record({
            type: 'checkpoint_touched',
            checkpointIndex,
            direction: contact.triangle.normal,
          })
        }
        return { isAccepted: false, body }
      }
      const property = getTrackMaterial(surfaces, material)
      if (property === undefined) return { isAccepted: true, body }
      if (getHasFlag(property, FINISH_FLAG)) record({ type: 'finish_touched' })
      if (getHasFlag(property, HIT_EVENT_FLAG)) {
        record({ type: 'surface_hit', identifier: property.thirdInteger, point: contact.point })
      }
      return { isAccepted: !getHasFlag(property, PASS_THROUGH_FLAG), body }
    },
    afterPass: (body) => getBodyWithSurfaces(body, surfaces, record, wheelEmitters),
  })
