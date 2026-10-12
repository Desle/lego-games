import {
  getBlendedQuaternion,
  getFloatFromBits,
  getMatrixFromQuaternion,
  getNormalizedVector2,
  getQuaternionFromMatrix,
  getSineCosine,
} from '../../../simulation-math/index.ts'
import type { Vector2, Vector3 } from '../../../simulation-math/index.ts'
import { CameraMode } from '../../types/camera-mode/camera-mode.ts'
import type {
  CameraRacerView,
  CameraState,
  CameraUpdate,
  CameraView,
} from '../../types/race-camera.types.ts'
import {
  arithmetic,
  getBasis,
  getHeadingAngle,
  getRow,
  PI,
  TWO_PI,
} from '../camera-math/camera-math.ts'
import type { ChaseHeading, ChaseLook, DistanceEasing } from './camera-update.types.ts'

// Float constants of Camera_Update 0x00428540 (.rdata at 0x004b03f0..0x004b0428).
const MAXIMUM_STEP_MILLISECONDS = 100
const FINISH_MILLISECONDS = 2000
const INTRODUCTION_MILLISECONDS = 2000
const FINISH_FADE_RATE = Math.fround(0.0005)
const FINISH_TURN_RATE = getFloatFromBits(0x3acde32e)
const STEERING_ANGLE_SCALE = 80
const STEERING_ANGLE_LIMIT = Math.fround(0.3)
const HEADING_DEADBAND = getFloatFromBits(0x3c656042)
const DISTANCE_GROWTH_FROM_NEGATIVE = Math.fround(0.004)
const DISTANCE_GROWTH_FROM_POSITIVE = Math.fround(0.002)
const MINIMUM_EASING_DISTANCE = 12
const COCKPIT_HEIGHT = 10
const COCKPIT_RAISED_HEIGHT = 6
// Racer +0xd68, the turbo level 0..3, picks the distance factor the pull-in starts from (0x00428b14..0x00428b38).
const STARTING_DISTANCE_FACTORS: readonly number[] = Object.freeze([
  Math.fround(-0.2),
  Math.fround(-0.4),
  Math.fround(-0.6),
  1,
])
// The up vector the chase modes give 0x004282d0.
const DOWN: Vector3 = Object.freeze({ x: 0, y: 0, z: -1 })

const { add, subtract, multiply, divide, storeFloat, getIsBelow } = arithmetic

// 1 / (rate * step + 1), the fraction every ease uses.
const getEaseFraction = (rate: number, stepMilliseconds: number): number =>
  divide(1, add(multiply(rate, stepMilliseconds), 1))

// 0x004280a0, the end of every mode: the target basis becomes a quaternion, and the eye and the quaternion ease from
// the previous frame's toward it (or jump to it when snapping); the matrix is rebuilt from the quaternion.
const getEasedCamera = (camera: CameraState): CameraState => {
  const targetQuaternion = getQuaternionFromMatrix(arithmetic, camera.targetBasis)
  if (camera.isPreviousSnapRequested) {
    return {
      ...camera,
      targetQuaternion,
      basis: camera.targetBasis,
      position: camera.targetPosition,
      quaternion: targetQuaternion,
    }
  }
  const positionFraction = getEaseFraction(camera.positionRate, camera.stepMilliseconds)
  const ease = (target: number, previous: number): number =>
    storeFloat(add(multiply(subtract(previous, target), positionFraction), target))
  const quaternion = getBlendedQuaternion(
    arithmetic,
    targetQuaternion,
    camera.previousQuaternion,
    getEaseFraction(camera.rotationRate, camera.stepMilliseconds)
  )
  return {
    ...camera,
    targetQuaternion,
    position: {
      x: ease(camera.targetPosition.x, camera.previousPosition.x),
      y: ease(camera.targetPosition.y, camera.previousPosition.y),
      z: ease(camera.targetPosition.z, camera.previousPosition.z),
    },
    quaternion,
    basis: getMatrixFromQuaternion(arithmetic, quaternion),
  }
}

// The introduction mode (mode 0, 0x00428639..0x00428764): for 2,000 ms the eye goes in a straight line from where the
// camera was released (or from the race description's camera point) to the chase target, the orientation along the
// blend of the two quaternions. The previous eye, basis and quaternion stay as they were placed.
const getIntroductionCamera = (camera: CameraState, racer: CameraRacerView): CameraState => {
  const isStarting = camera.modeMilliseconds === 0
  const previousQuaternion = isStarting
    ? getQuaternionFromMatrix(arithmetic, camera.previousBasis)
    : camera.previousQuaternion
  const targetQuaternion = isStarting
    ? getQuaternionFromMatrix(arithmetic, camera.targetBasis)
    : camera.targetQuaternion
  const elapsed = storeFloat(add(camera.stepMilliseconds, camera.modeMilliseconds))
  const isFinished = getIsBelow(INTRODUCTION_MILLISECONDS, elapsed)
  const modeMilliseconds = isFinished ? INTRODUCTION_MILLISECONDS : elapsed
  const fraction = isFinished ? 1 : storeFloat(multiply(elapsed, FINISH_FADE_RATE))
  const { previousPosition, targetPosition } = camera
  const offsetX = subtract(targetPosition.x, previousPosition.x)
  const offsetY = storeFloat(subtract(targetPosition.y, previousPosition.y))
  const offsetZ = storeFloat(subtract(targetPosition.z, previousPosition.z))
  const quaternion = getBlendedQuaternion(
    arithmetic,
    previousQuaternion,
    targetQuaternion,
    fraction
  )
  return {
    ...camera,
    lookAtPoint: racer.position,
    modeMilliseconds,
    previousQuaternion,
    targetQuaternion,
    position: {
      x: storeFloat(add(multiply(offsetX, fraction), previousPosition.x)),
      y: storeFloat(add(storeFloat(multiply(offsetY, fraction)), previousPosition.y)),
      z: storeFloat(add(storeFloat(multiply(offsetZ, fraction)), previousPosition.z)),
    },
    quaternion,
    basis: getMatrixFromQuaternion(arithmetic, quaternion),
  }
}

// The racer's heading in the plane (0x00428767..0x00428813): its forward row's x and y normalized; a car pointing
// straight up or down keeps the camera's last heading (1, 0 when it has none).
const getRacerHeading = (camera: CameraState, racer: CameraRacerView) => {
  const isRacerVertical = racer.rotation[0] === 0 && racer.rotation[1] === 0
  const isHeadingPresent = camera.heading.x !== 0 || camera.heading.y !== 0
  const remembered = isHeadingPresent ? camera.heading : { x: 1, y: 0, z: 0 }
  return {
    camera: isRacerVertical && !isHeadingPresent ? { ...camera, heading: remembered } : camera,
    heading: getNormalizedVector2(
      arithmetic,
      isRacerVertical ? remembered : { x: racer.rotation[0], y: racer.rotation[1] }
    ),
  }
}

// Turns the racer's heading by the steering angle, which eases toward `speed * 80 / turn radius` (at most 0.3),
// and eases the camera's heading toward the result unless it is within a deadband (0x00428878..0x00428a4d).
const getSteeredHeading = (
  camera: CameraState,
  racer: CameraRacerView,
  racerHeading: Vector2
): ChaseHeading => {
  const targetAngle =
    racer.turnRadius === 0
      ? 0
      : Math.min(
          Math.max(
            storeFloat(
              divide(multiply(racer.forwardSpeed, STEERING_ANGLE_SCALE), racer.turnRadius)
            ),
            -STEERING_ANGLE_LIMIT
          ),
          STEERING_ANGLE_LIMIT
        )
  const steeringAngle = storeFloat(
    add(
      multiply(
        getEaseFraction(camera.steeringRate, camera.stepMilliseconds),
        subtract(camera.steeringAngle, targetAngle)
      ),
      targetAngle
    )
  )
  const { sine, cosine } = getSineCosine(arithmetic, steeringAngle)
  const turnedX = storeFloat(
    subtract(multiply(cosine, racerHeading.x), multiply(sine, racerHeading.y))
  )
  // The engine reads the x it has just stored.
  const turnedY = storeFloat(add(multiply(cosine, racerHeading.y), multiply(sine, turnedX)))
  const currentAngle = getHeadingAngle(camera.heading.x, camera.heading.y)
  const turnedAngle = getHeadingAngle(turnedX, turnedY)
  const difference = subtract(currentAngle, turnedAngle)
  const isOutsideDeadband =
    getIsBelow(difference, -HEADING_DEADBAND) || getIsBelow(HEADING_DEADBAND, difference)
  const steered = { ...camera, steeringAngle }
  if (!isOutsideDeadband) return { camera: steered, x: turnedX, y: turnedY, z: 0 }
  let wrapped = difference
  while (getIsBelow(wrapped, -PI)) wrapped = add(wrapped, TWO_PI)
  while (getIsBelow(PI, wrapped)) wrapped = subtract(wrapped, TWO_PI)
  const easedAngle = storeFloat(
    add(
      multiply(wrapped, storeFloat(getEaseFraction(camera.headingRate, camera.stepMilliseconds))),
      turnedAngle
    )
  )
  const easedHeading = getSineCosine(arithmetic, easedAngle)
  return { camera: steered, x: easedHeading.cosine, y: easedHeading.sine, z: 0 }
}

const getChaseHeading = (camera: CameraState, racer: CameraRacerView): ChaseHeading => {
  const racerHeading = getRacerHeading(camera, racer)
  const { heading } = racerHeading
  if (camera.isPreviousSnapRequested) {
    return {
      camera: { ...racerHeading.camera, steeringAngle: 0 },
      x: heading.x,
      y: heading.y,
      z: 0,
    }
  }
  if (racer.isBodyFlagTwoSet) {
    const kept = racerHeading.camera.heading
    return { camera: racerHeading.camera, x: kept.x, y: kept.y, z: kept.z }
  }
  return getSteeredHeading(racerHeading.camera, racer, heading)
}

// The point the camera looks at eases toward the racer's position (0x00428a51..0x00428ac3); a snap takes it whole.
const getLookAtPoint = (camera: CameraState, racer: CameraRacerView): Vector3 => {
  if (camera.isPreviousSnapRequested) return racer.position
  const fraction = getEaseFraction(camera.lookAtRate, camera.stepMilliseconds)
  const offsetX = subtract(camera.lookAtPoint.x, racer.position.x)
  const offsetY = storeFloat(subtract(camera.lookAtPoint.y, racer.position.y))
  const offsetZ = storeFloat(subtract(camera.lookAtPoint.z, racer.position.z))
  return {
    x: storeFloat(add(storeFloat(multiply(offsetX, fraction)), racer.position.x)),
    y: storeFloat(add(storeFloat(multiply(offsetY, fraction)), racer.position.y)),
    z: storeFloat(add(multiply(fraction, offsetZ), racer.position.z)),
  }
}

// 0x00428ade..0x00428c0c: when the driver goes to full throttle (a turbo start) the distance factor starts below
// zero by turbo level and climbs back to 1; while below 1 the follow distance is the factor times the preset's,
// at least 12.
const getDistanceEasing = (camera: CameraState, racer: CameraRacerView): DistanceEasing => {
  const startFactor = STARTING_DISTANCE_FACTORS[racer.turboLevel]
  const isStarting = !camera.isFullThrottle && racer.isFullThrottle && startFactor !== undefined
  const started = {
    ...camera,
    isFullThrottle: racer.isFullThrottle,
    distanceFactor: isStarting ? startFactor : camera.distanceFactor,
  }
  if (!getIsBelow(started.distanceFactor, 1)) return { camera: started, distance: started.distance }
  const growth =
    started.distanceFactor < 0 ? DISTANCE_GROWTH_FROM_NEGATIVE : DISTANCE_GROWTH_FROM_POSITIVE
  const distanceFactor = storeFloat(
    add(multiply(started.stepMilliseconds, growth), started.distanceFactor)
  )
  if (distanceFactor > 1) {
    return { camera: { ...started, distanceFactor: 1 }, distance: started.distance }
  }
  const scaled = storeFloat(multiply(distanceFactor, started.distance))
  const magnitude = distanceFactor < 0 ? -scaled : scaled
  return {
    camera: { ...started, distanceFactor },
    distance: getIsBelow(magnitude, MINIMUM_EASING_DISTANCE) ? MINIMUM_EASING_DISTANCE : magnitude,
  }
}

// Mode 3 within its two seconds (0x00428c9e..0x00428d4f): the preset offsets fade out and the heading turns half
// a circle over 2,000 ms (π/2000 per millisecond), scaled by the eased pitch cosine.
const getFinishLook = (
  camera: CameraState,
  heading: Vector3,
  modeMilliseconds: number
): ChaseLook => {
  const fade = subtract(1, multiply(modeMilliseconds, FINISH_FADE_RATE))
  const offsets = camera.finishOffsets
  const turn = getSineCosine(arithmetic, multiply(modeMilliseconds, FINISH_TURN_RATE))
  const scale = storeFloat(add(multiply(offsets.pitchCosine, fade), camera.pitchCosine))
  return {
    distance: storeFloat(add(multiply(offsets.distance, fade), camera.distance)),
    heightSine: storeFloat(add(multiply(offsets.heightSine, fade), camera.heightSine)),
    look: {
      x: storeFloat(
        multiply(subtract(multiply(heading.x, turn.cosine), multiply(heading.y, turn.sine)), scale)
      ),
      y: storeFloat(
        multiply(add(multiply(heading.x, turn.sine), multiply(heading.y, turn.cosine)), scale)
      ),
      z: -storeFloat(add(multiply(offsets.pitchSine, fade), camera.pitchSine)),
    },
  }
}

// The direction the eye looks along and the distance it keeps (0x00428c79..0x00428dab).
const getChaseLook = (
  camera: CameraState,
  heading: Vector3,
  followDistance: number,
  modeMilliseconds: number
): ChaseLook => {
  if (camera.mode === CameraMode.FINISH) {
    if (modeMilliseconds < FINISH_MILLISECONDS)
      return getFinishLook(camera, heading, modeMilliseconds)
    return {
      distance: camera.distance,
      heightSine: camera.heightSine,
      look: {
        x: -storeFloat(multiply(camera.pitchCosine, heading.x)),
        y: -storeFloat(multiply(heading.y, camera.pitchCosine)),
        z: -camera.pitchSine,
      },
    }
  }
  return {
    distance: followDistance,
    heightSine: camera.heightSine,
    look: {
      x: storeFloat(multiply(camera.pitchCosine, heading.x)),
      y: storeFloat(multiply(heading.y, camera.pitchCosine)),
      z: -camera.pitchSine,
    },
  }
}

// The chase and finish modes (0x00428767..0x00428e4e).
const getChaseCamera = (camera: CameraState, racer: CameraRacerView): CameraState => {
  const steered = getChaseHeading(camera, racer)
  const lookAtPoint = getLookAtPoint(steered.camera, racer)
  const easing = getDistanceEasing(steered.camera, racer)
  const isHeadingPresent = steered.x !== 0 || steered.y !== 0
  const storedHeading = isHeadingPresent
    ? { x: steered.x, y: steered.y, z: steered.z }
    : easing.camera.heading
  const heading: Vector3 = {
    ...getNormalizedVector2(arithmetic, storedHeading),
    z: 0,
  }
  const isFinishing = easing.camera.mode === CameraMode.FINISH
  const modeMilliseconds = isFinishing
    ? Math.min(
        storeFloat(add(easing.camera.stepMilliseconds, easing.camera.modeMilliseconds)),
        FINISH_MILLISECONDS
      )
    : easing.camera.modeMilliseconds
  const chase = getChaseLook(easing.camera, heading, easing.distance, modeMilliseconds)
  const eyeBehind = camera.isPreviousSnapRequested
    ? chase.look
    : getRow(easing.camera.previousBasis, 2)
  const targetPosition: Vector3 = camera.isPreviousSnapRequested
    ? {
        x: storeFloat(subtract(lookAtPoint.x, storeFloat(multiply(chase.distance, eyeBehind.x)))),
        y: storeFloat(subtract(lookAtPoint.y, storeFloat(multiply(eyeBehind.y, chase.distance)))),
        z: storeFloat(
          subtract(lookAtPoint.z, multiply(subtract(eyeBehind.z, chase.heightSine), chase.distance))
        ),
      }
    : {
        x: storeFloat(subtract(lookAtPoint.x, multiply(eyeBehind.x, chase.distance))),
        y: storeFloat(subtract(lookAtPoint.y, multiply(eyeBehind.y, chase.distance))),
        z: storeFloat(
          subtract(lookAtPoint.z, multiply(subtract(eyeBehind.z, chase.heightSine), chase.distance))
        ),
      }
  return {
    ...easing.camera,
    modeMilliseconds,
    lookAtPoint,
    heading,
    targetPosition,
    targetBasis: getBasis(chase.look, DOWN),
  }
}

// The cockpit camera (mode 2, 0x00428e5c): at the racer, looking along its forward row with its third row
// negated as the up reference, a little above it (6 when the second preset argument was set, else 10).
const getCockpitCamera = (camera: CameraState, racer: CameraRacerView): CameraState => {
  const forward = getRow(racer.rotation, 0)
  const third = getRow(racer.rotation, 2)
  const height = camera.isOffsetRaised ? COCKPIT_RAISED_HEIGHT : COCKPIT_HEIGHT
  return {
    ...camera,
    lookAtPoint: racer.position,
    targetBasis: getBasis(forward, { x: -third.x, y: -third.y, z: -third.z }),
    targetPosition: {
      x: racer.position.x,
      y: racer.position.y,
      z: storeFloat(add(racer.position.z, height)),
    },
  }
}

// 0x00427d30: the arguments of the camera object's position slot (+0x44) and orientation slot (+0x24). Looking
// behind mirrors the eye through the point looked at (chase) and turns forward and up half a turn around the
// vertical axis; the cockpit camera only reverses the forward vector.
export const getCameraView = (camera: CameraState): CameraView => {
  const forward = getRow(camera.basis, 2)
  const up = getRow(camera.basis, 1)
  if (camera.mode === CameraMode.CHASE && camera.isLookingBehind) {
    return {
      position: {
        x: storeFloat(subtract(add(camera.lookAtPoint.x, camera.lookAtPoint.x), camera.position.x)),
        y: storeFloat(subtract(add(camera.lookAtPoint.y, camera.lookAtPoint.y), camera.position.y)),
        z: camera.position.z,
      },
      forward: { x: -forward.x, y: -forward.y, z: forward.z },
      up: { x: -up.x, y: -up.y, z: up.z },
    }
  }
  if (camera.mode === CameraMode.COCKPIT && camera.isLookingBehind) {
    return {
      position: camera.position,
      forward: { x: -forward.x, y: -forward.y, z: -forward.z },
      up,
    }
  }
  return { position: camera.position, forward, up }
}

// Camera_Update 0x00428540 for one physics sub-step of `stepMilliseconds` (the race calls it once per sub-step,
// after the racers have moved). The chase, cockpit and finish modes are ported. Not ported: the introduction mode,
// the field-of-view effects (0x00427e80, which draw from the random table), the camera object's lock (+0x28) and
// the sound listener (0x00427c00).
export const updateCamera = (
  camera: CameraState,
  racer: CameraRacerView,
  stepMilliseconds: number
): CameraUpdate => {
  if (!camera.isAttached) {
    const waiting = { ...camera, isSnapRequested: true }
    return { camera: waiting, view: getCameraView(waiting) }
  }
  if (!(stepMilliseconds > 0) && !camera.isSnapRequested) {
    return { camera, view: getCameraView(camera) }
  }
  const step = stepMilliseconds > 0 ? Math.min(stepMilliseconds, MAXIMUM_STEP_MILLISECONDS) : 0
  const isIntroduction = camera.mode === CameraMode.INTRODUCTION
  const started: CameraState = {
    ...camera,
    isPreviousSnapRequested: camera.isSnapRequested,
    isSnapRequested: false,
    stepMilliseconds: Math.fround(step),
    ...(isIntroduction
      ? {}
      : {
          previousBasis: camera.basis,
          previousPosition: camera.position,
          previousQuaternion: camera.quaternion,
        }),
  }
  if (isIntroduction) {
    const introduced = getIntroductionCamera(started, racer)
    return { camera: introduced, view: getCameraView(introduced) }
  }
  const placed =
    started.mode === CameraMode.COCKPIT
      ? getCockpitCamera(started, racer)
      : getChaseCamera(started, racer)
  const eased = getEasedCamera(placed)
  return { camera: eased, view: getCameraView(eased) }
}
