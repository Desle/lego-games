import { createRace, IDLE_RACER_CONTROLS, NO_RACE_CONTACTS, stepRace } from '../../../race/index.ts'
import type { RaceDefinition, RaceState } from '../../../race/index.ts'
import { RaceBinding } from '../../../race-input/index.ts'
import type { RaceBindingValue } from '../../../race-input/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { TraceFrameInput } from '../../types/golden-trace.types.ts'
import { getFrameControls } from '../port-trace/port-trace.ts'
import { holdBindings } from '../trace-scenarios/trace-scenarios.ts'
import {
  FRAME_MILLISECONDS,
  FRAMES_BEFORE_THROTTLE,
  getDistance,
  getGuidePosition,
  getPlayerPose,
  GUIDE_RACER_INDEX,
} from './route-driving.ts'
import type { DrivingPose } from './route-driving.types.ts'

// The guide finishes its first lap well inside this many frames on every track the traces drive.
const GUIDE_FRAME_LIMIT = 2400
// How many points of the lap, from the one nearest the player, the search for the nearest point looks at.
const NEAREST_WINDOW = 60
// The player aims at the first point of the lap ahead of it that is at least this far away.
const AIM_DISTANCE = 40
const STEERING_DEAD_ZONE = 0.1

// The guide's positions from the moment the race lets it go to the end of its first lap.
const getGuideLap = (definition: RaceDefinition): readonly Vector3[] => {
  const idleInputs = { controls: [IDLE_RACER_CONTROLS], contacts: NO_RACE_CONTACTS }
  const lap: Vector3[] = []
  let guideRun = createRace(definition)
  for (let frame = 0; frame < GUIDE_FRAME_LIMIT; frame += 1) {
    guideRun = stepRace(guideRun, idleInputs, FRAME_MILLISECONDS).raceState
    if ((guideRun.racerSet.racers[GUIDE_RACER_INDEX]?.currentLap ?? 0) > 0) break
    if (frame >= FRAMES_BEFORE_THROTTLE) lap.push(getGuidePosition(guideRun))
  }
  return lap
}

// Which way to steer to reach `target` from `pose`: the sign of the heading's cross product with the aim, positive
// when the target is on the left, which positive steering (the left arrow) turns towards.
const getSteeringBindings = (pose: DrivingPose, target: Vector3): RaceBindingValue[] => {
  const aimX = target.x - pose.position.x
  const aimY = target.y - pose.position.y
  const length = Math.hypot(aimX, aimY)
  if (length === 0) return []
  const cross = (pose.forward.x * aimY - pose.forward.y * aimX) / length
  if (cross > STEERING_DEAD_ZONE) return [RaceBinding.STEER_POSITIVE]
  if (cross < -STEERING_DEAD_ZONE) return [RaceBinding.STEER_NEGATIVE]
  return []
}

// Closed-loop key frames that drive the player once round the track on the line of computer racer `1`'s first lap,
// either way: the port drives the player at full throttle towards the first point of the lap that is `AIM_DISTANCE`
// away, and the keys it chose are then replayed in the original. A reversed lap meets the end of the track first,
// which brings the player to the objects on the far side of the start line in a few hundred frames.
export const getLapDrivingFrames = (
  definition: RaceDefinition,
  frameCount: number,
  isReversed: boolean,
  aimDistance = AIM_DISTANCE
): readonly TraceFrameInput[] => {
  const lap = getGuideLap(definition)
  const path = isReversed ? [...lap].reverse() : lap
  const idleInputs = { controls: [IDLE_RACER_CONTROLS], contacts: NO_RACE_CONTACTS }
  let raceState: RaceState = createRace(definition)
  for (let frame = 0; frame < FRAMES_BEFORE_THROTTLE; frame += 1) {
    raceState = stepRace(raceState, idleInputs, FRAME_MILLISECONDS).raceState
  }
  const frames: TraceFrameInput[] = [...holdBindings(FRAMES_BEFORE_THROTTLE, [])]
  let nearestIndex = 0
  for (let frame = 0; frame < frameCount; frame += 1) {
    const pose = getPlayerPose(raceState)
    let nearestDistance = Number.POSITIVE_INFINITY
    for (
      let index = nearestIndex;
      index < Math.min(nearestIndex + NEAREST_WINDOW, path.length);
      index += 1
    ) {
      const point = path[index]
      if (point === undefined) continue
      const distance = getDistance(point, pose.position)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }
    const aheadIndex = path.findIndex(
      (point, index) => index > nearestIndex && getDistance(point, pose.position) >= aimDistance
    )
    const target = path[aheadIndex === -1 ? path.length - 1 : aheadIndex]
    const bindings = [
      RaceBinding.ACCELERATE,
      ...(target === undefined ? [] : getSteeringBindings(pose, target)),
    ]
    const keyFrame = holdBindings(1, bindings)[0]
    if (keyFrame === undefined) throw new RangeError('No key frame')
    frames.push(keyFrame)
    raceState = stepRace(
      raceState,
      { controls: [getFrameControls(keyFrame)], contacts: NO_RACE_CONTACTS },
      FRAME_MILLISECONDS
    ).raceState
  }
  return frames
}
