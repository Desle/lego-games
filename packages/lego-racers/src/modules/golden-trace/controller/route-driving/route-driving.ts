import { createRace, IDLE_RACER_CONTROLS, NO_RACE_CONTACTS, stepRace } from '../../../race/index.ts'
import type { RaceDefinition, RaceState } from '../../../race/index.ts'
import { RaceBinding } from '../../../race-input/index.ts'
import type { RaceBindingValue } from '../../../race-input/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { DrivingPose } from './route-driving.types.ts'
import type { TraceFrameInput } from '../../types/golden-trace.types.ts'
import { holdBindings } from '../trace-scenarios/trace-scenarios.ts'

const FRAME_MILLISECONDS = 33
// How far ahead on the computer racer's path the player aims, in path points (one per frame).
const LOOKAHEAD_POINTS = 14
// The player aims at the first path point at least this far away.
const LOOKAHEAD_DISTANCE = 45
// The sideways component of the aim, relative to the distance, below which the player drives straight.
const STEERING_DEAD_ZONE = 0.12
const FRAMES_BEFORE_THROTTLE = 175
const GUIDE_RACER_INDEX = 1
// A player slower than this for this many frames reverses for a while.
const STUCK_SPEED = 0.015
const STUCK_FRAMES = 45
const REVERSE_FRAMES = 40

const getPlayerPose = (raceState: RaceState): DrivingPose => {
  const racer = raceState.racerSet.racers[0]
  if (racer === undefined) throw new RangeError('The race has no player')
  const { frame } = racer.carBody.rigidBody
  return {
    position: frame.position,
    forward: { x: frame.rotation[0], y: frame.rotation[1], z: frame.rotation[2] },
  }
}

const getGuidePosition = (raceState: RaceState): Vector3 => {
  const guide = raceState.racerSet.racers[GUIDE_RACER_INDEX]
  if (guide === undefined) throw new RangeError('The race has no guide racer')
  return guide.carBody.rigidBody.frame.position
}

const getDistance = (left: Vector3, right: Vector3): number =>
  Math.hypot(left.x - right.x, left.y - right.y)

// Which way to steer to reach `target` from `pose`: the sign of the heading's cross product with the aim. In the
// original's steering, positive steering (the left arrow) turns to the left.
const getSteeringBinding = (pose: DrivingPose, target: Vector3): RaceBindingValue[] => {
  const aimX = target.x - pose.position.x
  const aimY = target.y - pose.position.y
  const length = Math.hypot(aimX, aimY)
  if (length === 0) return []
  const cross = (pose.forward.x * aimY - pose.forward.y * aimX) / length
  if (cross > STEERING_DEAD_ZONE) return [RaceBinding.STEER_NEGATIVE]
  if (cross < -STEERING_DEAD_ZONE) return [RaceBinding.STEER_POSITIVE]
  return []
}

// Closed-loop key frames for a lap: the port drives a player towards a point a little ahead on the path of the
// computer racer `1`, which the port races without a player's help; the keys it chose are then replayed in the
// original. The original and the port agree on the player (that is what the trace checks), so the keys fit both.
export const getRouteDrivingFrames = (
  definition: RaceDefinition,
  frameCount: number
): readonly TraceFrameInput[] => {
  const idleInputs = { controls: [IDLE_RACER_CONTROLS], contacts: NO_RACE_CONTACTS }
  let guideRun = createRace(definition)
  const guidePath: Vector3[] = []
  for (let frame = 0; frame < frameCount + LOOKAHEAD_POINTS; frame += 1) {
    guideRun = stepRace(guideRun, idleInputs, FRAME_MILLISECONDS).raceState
    guidePath.push(getGuidePosition(guideRun))
  }
  let raceState = createRace(definition)
  const frames: TraceFrameInput[] = [...holdBindings(FRAMES_BEFORE_THROTTLE, [])]
  for (let frame = 0; frame < FRAMES_BEFORE_THROTTLE; frame += 1) {
    raceState = stepRace(raceState, idleInputs, FRAME_MILLISECONDS).raceState
  }
  let nearestIndex = 0
  let stuckFrames = 0
  let reverseFramesLeft = 0
  for (let frame = 0; frame < frameCount; frame += 1) {
    const pose = getPlayerPose(raceState)
    for (let index = nearestIndex; index < guidePath.length - LOOKAHEAD_POINTS; index += 1) {
      const point = guidePath[index]
      const next = guidePath[nearestIndex]
      if (
        point !== undefined &&
        next !== undefined &&
        getDistance(point, pose.position) < getDistance(next, pose.position)
      ) {
        nearestIndex = index
      }
      if (index - nearestIndex > 40) break
    }
    const aheadIndex = guidePath.findIndex(
      (point, index) =>
        index > nearestIndex && getDistance(point, pose.position) >= LOOKAHEAD_DISTANCE
    )
    const target = guidePath[aheadIndex === -1 ? guidePath.length - 1 : aheadIndex]
    const speed = raceState.racerSet.racers[0]?.carBody.rigidBody.speed ?? 0
    stuckFrames = speed < STUCK_SPEED ? stuckFrames + 1 : 0
    if (stuckFrames > STUCK_FRAMES && reverseFramesLeft === 0) reverseFramesLeft = REVERSE_FRAMES
    const isReversing = reverseFramesLeft > 0
    reverseFramesLeft = Math.max(reverseFramesLeft - 1, 0)
    if (isReversing) stuckFrames = 0
    const steering = target === undefined ? [] : getSteeringBinding(pose, target)
    const reversedSteering = steering.map((binding) =>
      binding === RaceBinding.STEER_POSITIVE
        ? RaceBinding.STEER_NEGATIVE
        : RaceBinding.STEER_POSITIVE
    )
    const bindings = isReversing
      ? [RaceBinding.BRAKE, ...reversedSteering]
      : [RaceBinding.ACCELERATE, ...steering]
    const keyFrame = holdBindings(1, bindings)[0]
    if (keyFrame === undefined) throw new RangeError('No key frame')
    frames.push(keyFrame)
    const controls = [
      {
        ...IDLE_RACER_CONTROLS,
        isAcceleratePressed: !isReversing,
        isBrakePressed: isReversing,
        isSteerPositivePressed: bindings.includes(RaceBinding.STEER_POSITIVE),
        isSteerNegativePressed: bindings.includes(RaceBinding.STEER_NEGATIVE),
      },
    ]
    raceState = stepRace(
      raceState,
      { controls, contacts: NO_RACE_CONTACTS },
      FRAME_MILLISECONDS
    ).raceState
  }
  return frames
}
