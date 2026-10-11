import {
  getFloatFromBits,
  getFrameTransformedPoint,
  IDENTITY_MATRIX3,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { createBoxRigidBody } from '../rigid-body/rigid-body.ts'
import type {
  CarRigidBody,
  CarRigidBodyDefinition,
  CarWheel,
  StepStartSnapshot,
  WheelSnapshot,
} from '../racer-physics.types.ts'

// float32 0x3a83126f at 0x004af220.
const ONE_THOUSANDTH = getFloatFromBits(0x3a83126f)

export const WHEEL_COUNT = 4
export const HULL_POINT_COUNT = 4
export const TRIANGLE_CACHE_CAPACITY = 8

// Bits of car rigid body +0x6c0. Meanings follow from the code that sets and tests them.
export const CarRigidBodyFlag = Object.freeze({
  // 0x00447f30: drifting (yaw rate from the drift factor, braking along the velocity).
  DRIFTING: 0x1,
  // 0x00448160: spinning out (the yaw timer shortens the sub-step, no yaw-rate steering).
  SPINNING: 0x2,
  // 0x00448160: the spin has just started; RigidBody_Step clears it once.
  SPIN_STARTED: 0x4,
  // 0x00448660: two-point mode (0x004464a0, 0x004465c0 instead of 0x00445dc0).
  TWO_POINT: 0x8,
  // 0x00448760 and 0x004487b0: add extra force A (+0x630) or B (+0x63c) every pass.
  EXTRA_FORCE_A: 0x20,
  EXTRA_FORCE_B: 0x40,
  // 0x00448800: the +0x6e0 countdown runs; also stops surface friction and probes from shortening.
  FLAGGED: 0x80,
  // 0x00447330: the body has no linear and no angular velocity; 0x00445dc0 skips probing.
  AT_REST: 0x100,
  // 0x00448070 clears it with DRIFTING.
  DRIFT_SOUND: 0x200,
  // 0x00449070: the model leans into turns (0x004452b0).
  LEANING: 0x400,
  // 0x00447cf0: a wall turned the car; the yaw-rate steering waits for the yaw timer.
  WALL_TURN: 0x800,
  // RigidBody_Step passes !(flags & 0x1000) to 0x004478b0: test the hull against the track.
  WITHOUT_TRACK_CONTACTS: 0x1000,
})

// 0x00444b40: +0x18c..+0x194 = (0, 0, 0.2), from 0x004b0cf8.
const DEFAULT_SETTLE_OFFSET: Vector3 = Object.freeze({
  x: 0,
  y: 0,
  z: getFloatFromBits(0x3e4ccccd),
})

const EMPTY_WHEEL: CarWheel = Object.freeze({
  groundForce: ZERO_VECTOR3,
  anchor: ZERO_VECTOR3,
  probeStart: ZERO_VECTOR3,
  probeEnd: ZERO_VECTOR3,
  contactPoint: ZERO_VECTOR3,
  material: undefined,
  previousMaterial: undefined,
  cachedTriangleIndex: -1,
  isOnGround: false,
  isProbed: false,
  depthSquared: 0,
  surfaceDrag: 0,
  surfaceGrip: 0,
  surfaceSkidGrip: 0,
  grip: 0,
  surfaceValue60: 0,
  surfaceForce: ZERO_VECTOR3,
})

const getWheelSnapshot = (wheel: CarWheel): WheelSnapshot =>
  Object.freeze({
    anchor: wheel.anchor,
    material: wheel.material,
    isOnGround: wheel.isOnGround,
    isProbed: wheel.isProbed,
    surfaceDrag: wheel.surfaceDrag,
    surfaceGrip: wheel.surfaceGrip,
    surfaceSkidGrip: wheel.surfaceSkidGrip,
    grip: wheel.grip,
    surfaceValue60: wheel.surfaceValue60,
    surfaceForce: wheel.surfaceForce,
  })

// 0x004474c0: saves the start of a pass. It also copies each wheel's material to its previous material.
export const saveStepStart = (body: CarRigidBody): CarRigidBody => {
  const wheels = body.wheels.map((wheel) =>
    Object.freeze({ ...wheel, previousMaterial: wheel.material })
  )
  const stepStart: StepStartSnapshot = Object.freeze({
    linearVelocity: body.linearVelocity,
    position: body.frame.position,
    rotation: body.frame.rotation,
    worldInverseInertia: body.worldInverseInertia,
    angularVelocity: body.angularVelocity,
    angularMomentum: body.angularMomentum,
    twoPointHeight: body.twoPointHeight,
    twoPointTilt: body.twoPointTilt,
    heading: body.heading,
    wheels: Object.freeze(wheels.map(getWheelSnapshot)),
    worldHullPoints: body.worldHullPoints,
  })
  return Object.freeze({ ...body, wheels: Object.freeze(wheels), stepStart })
}

// 0x00447690, the first half: puts back what 0x004474c0 saved. The caller then runs
// frame slot +0x2c for the world centre of mass and 0x00447330.
export const getRestoredStepStart = (body: CarRigidBody): CarRigidBody => {
  const { stepStart } = body
  const wheels = body.wheels.map((wheel, index) =>
    Object.freeze({ ...wheel, ...(stepStart.wheels[index] ?? getWheelSnapshot(wheel)) })
  )
  return Object.freeze({
    ...body,
    frame: Object.freeze({ rotation: stepStart.rotation, position: stepStart.position }),
    linearVelocity: stepStart.linearVelocity,
    worldInverseInertia: stepStart.worldInverseInertia,
    angularVelocity: stepStart.angularVelocity,
    angularMomentum: stepStart.angularMomentum,
    twoPointHeight: stepStart.twoPointHeight,
    twoPointTilt: stepStart.twoPointTilt,
    heading: stepStart.heading,
    wheels: Object.freeze(wheels),
    worldHullPoints: stepStart.worldHullPoints,
  })
}

// Frame slot +0x2c on the frame centre of mass (+0x14 → +0x20), as RigidBody_Step and 0x00447690 run it.
export const getWithWorldCentreOfMass = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody =>
  Object.freeze({
    ...body,
    worldCentreOfMass: getFrameTransformedPoint(arithmetic, body.frame, body.localCentreOfMass),
  })

const replaceAnchor = (wheel: CarWheel | undefined, anchor: Vector3): CarWheel =>
  Object.freeze({ ...(wheel ?? EMPTY_WHEEL), anchor })

// 0x00448c70: wheel 1 is the frame's +0x358 point; wheel 0 lies a track width along -row 1 from it,
// wheel 3 a wheelbase along -row 0, wheel 2 both.
export const getWithWheelAnchors = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody => {
  const { subtract, multiply, storeFloat } = arithmetic
  const { rotation } = body.frame
  const anchor1 = getFrameTransformedPoint(arithmetic, body.frame, body.localWheelAnchor)
  const lengthX = multiply(rotation[0], body.wheelbase)
  const lengthY = storeFloat(multiply(rotation[1], body.wheelbase))
  const lengthZ = storeFloat(multiply(rotation[2], body.wheelbase))
  const widthX = multiply(rotation[3], body.trackWidth)
  const widthY = storeFloat(multiply(rotation[4], body.trackWidth))
  const widthZ = storeFloat(multiply(rotation[5], body.trackWidth))
  const anchor0 = Object.freeze({
    x: storeFloat(subtract(anchor1.x, widthX)),
    y: storeFloat(subtract(anchor1.y, widthY)),
    z: storeFloat(subtract(anchor1.z, widthZ)),
  })
  const anchor3 = Object.freeze({
    x: storeFloat(subtract(anchor1.x, lengthX)),
    y: storeFloat(subtract(anchor1.y, lengthY)),
    z: storeFloat(subtract(anchor1.z, lengthZ)),
  })
  const anchor2 = Object.freeze({
    x: storeFloat(subtract(anchor0.x, lengthX)),
    y: storeFloat(subtract(anchor0.y, lengthY)),
    z: storeFloat(subtract(anchor0.z, lengthZ)),
  })
  const anchors = [anchor0, anchor1, anchor2, anchor3]
  return Object.freeze({
    ...body,
    wheels: Object.freeze(
      anchors.map((anchor, index) => replaceAnchor(body.wheels[index], anchor))
    ),
  })
}

// 0x00446e60 (thiscall: point, track width, wheelbase): the wheel geometry, then 0x00448c70.
export const setWheelGeometry = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  localWheelAnchor: Vector3,
  trackWidth: number,
  wheelbase: number
): CarRigidBody =>
  getWithWheelAnchors(
    arithmetic,
    Object.freeze({ ...body, localWheelAnchor, trackWidth, wheelbase })
  )

// 0x00446ea0 (thiscall: index, point): one hull point, and its world position through frame slot +0x2c.
export const setHullPoint = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  index: number,
  localPoint: Vector3
): CarRigidBody => {
  const worldPoint = getFrameTransformedPoint(arithmetic, body.frame, localPoint)
  return Object.freeze({
    ...body,
    localHullPoints: Object.freeze(
      body.localHullPoints.map((point, pointIndex) => (pointIndex === index ? localPoint : point))
    ),
    worldHullPoints: Object.freeze(
      body.worldHullPoints.map((point, pointIndex) => (pointIndex === index ? worldPoint : point))
    ),
  })
}

// 0x00441190 (thiscall: point): the centre of mass in the frame, and in the world through slot +0x2c.
export const setLocalCentreOfMass = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  localCentreOfMass: Vector3
): CarRigidBody =>
  getWithWorldCentreOfMass(arithmetic, Object.freeze({ ...body, localCentreOfMass }))

const getRepeated = <Value>(value: Value, count: number): readonly Value[] =>
  Object.freeze(Array.from({ length: count }, () => value))

// The constructor 0x00444b10 (0x00444b40 sets the defaults, then slot 6 sets the top speed 110)
// and the setup 0x00444d90: the frame takes the model frame's rotation and position, the box
// body is attached (0x00441210, 0x004409f0) and the scaled mass is mass × 0.001 × 0.001.
export const createCarRigidBody = (
  arithmetic: FloatArithmetic,
  definition: CarRigidBodyDefinition
): CarRigidBody => {
  const { multiply, storeFloat } = arithmetic
  const frame = Object.freeze({
    rotation: definition.displayFrame.rotation,
    position: definition.displayFrame.position,
  })
  const box = createBoxRigidBody(arithmetic, {
    frame,
    mass: definition.mass,
    dimensions: definition.dimensions,
  })
  const heading = Object.freeze({
    x: frame.rotation[0],
    y: frame.rotation[1],
    z: frame.rotation[2],
  })
  const body: CarRigidBody = {
    ...box,
    displayFrame: definition.displayFrame,
    displayBoundingRadius: definition.displayBoundingRadius,
    scaledMass: storeFloat(multiply(multiply(definition.mass, ONE_THOUSANDTH), ONE_THOUSANDTH)),
    gravity: getFloatFromBits(0x421c0000),
    weight: 0,
    heading,
    groundNormal: ZERO_VECTOR3,
    slopeForce: ZERO_VECTOR3,
    settleOffset: DEFAULT_SETTLE_OFFSET,
    wheels: getRepeated(EMPTY_WHEEL, WHEEL_COUNT),
    localWheelAnchor: ZERO_VECTOR3,
    trackWidth: 0,
    wheelbase: 0,
    groundedWheelCount: 0,
    localHullPoints: getRepeated(ZERO_VECTOR3, HULL_POINT_COUNT),
    worldHullPoints: getRepeated(ZERO_VECTOR3, HULL_POINT_COUNT),
    hullContacts: getRepeated(false, HULL_POINT_COUNT),
    contactNormal: ZERO_VECTOR3,
    contactCount: 0,
    stepRemaining: 0,
    triangleCache: Object.freeze([]),
    rollTimer: 0,
    pitchTimer: 0,
    yawTimer: 0,
    spinTimer: 0,
    spinPeriod: 0,
    drag: 0,
    gripScale: 1,
    velocityDirection: Object.freeze({ x: 1, y: 0, z: 0 }),
    speed: 0,
    topSpeed: getFloatFromBits(0x42dc0000),
    forwardVelocity: ZERO_VECTOR3,
    forwardSpeed: 0,
    lateralVelocity: ZERO_VECTOR3,
    throttle: 0,
    extraForceA: ZERO_VECTOR3,
    extraForceB: ZERO_VECTOR3,
    centripetalForce: 0,
    turnRadius: 0,
    yawRate: 0,
    twoPointHeight: 0,
    twoPointTargetHeight: getFloatFromBits(0x40c00000),
    twoPointHeightRate: getFloatFromBits(0x40400000),
    twoPointTargetTilt: 0,
    twoPointTilt: 0,
    twoPointPositions: getRepeated(ZERO_VECTOR3, 2),
    stepStart: Object.freeze({
      linearVelocity: ZERO_VECTOR3,
      position: ZERO_VECTOR3,
      rotation: IDENTITY_MATRIX3,
      worldInverseInertia: IDENTITY_MATRIX3,
      angularVelocity: ZERO_VECTOR3,
      angularMomentum: ZERO_VECTOR3,
      twoPointHeight: 0,
      twoPointTilt: 0,
      heading,
      wheels: Object.freeze([]),
      worldHullPoints: getRepeated(ZERO_VECTOR3, HULL_POINT_COUNT),
    }),
    flags: 0,
    driftYawFactor: 1,
    driftThreshold: -1,
    driftMaximumAngle: getFloatFromBits(0x40490fdb),
    driftBrake: 0,
    lean: 0,
    leanFactor: getFloatFromBits(0x3e4ccccd),
    airborneTime: 0,
    flaggedTimer: 0,
  }
  return Object.freeze(body)
}
