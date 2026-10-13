import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Box3, Matrix4, Scene, Vector3 } from 'three'
import type { DriverDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getPosedBonePoints } from '../ldraw-fidelity/fidelity-anchors.ts'
import { getVisibleBounds } from '../ldraw-fidelity/fidelity-render.ts'
import { waitForStableMeshes } from '../ldraw-fidelity/fidelity-pairs.ts'
import { MinifigPartKey } from '../ldraw-racer/minifig-assembly.types.ts'
import { getMinifigRig } from '../ldraw-racer/minifig-rig.ts'
import { createSkeletonPoseSampler } from '../ldraw-racer/skeleton-pose.ts'
import type { SkeletonPoseSampler } from '../ldraw-racer/skeleton-pose.types.ts'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type {
  DriverSeatMeasurement,
  DriverSeatPose,
  DriverSeatSubject,
} from './hd-coverage.types.ts'
import { getRounded, getSteeringWheelOffset } from './steering-wheel-offset.ts'
import { STUD_WIDTH } from '@lego-games/ldraw/building'

const getSideways = (bounds: Box3): number | null =>
  bounds.isEmpty() ? null : bounds.getCenter(new Vector3()).y * STUD_WIDTH

// The race's poses of a seated driver: seated (clip 9 at its start) and steering (clip 6, 200 ms in), as the fidelity harness poses them.
const RACE_POSES: readonly DriverSeatPose[] = [
  { name: 'seated', clipIndex: 9, milliseconds: 0 },
  { name: 'steering', clipIndex: 6, milliseconds: 200 },
]

const getPoseState = (sampler: SkeletonPoseSampler, clipIndex: number, milliseconds: number) => {
  const start = sampler.createState(clipIndex)
  return start === null ? null : sampler.advance(start, milliseconds)
}

// The original driver's torso on the seat: the centre of its torso bone's corners in the car's frame.
const getOriginalTorsoOffset = (
  model: ModelScene,
  sampler: SkeletonPoseSampler,
  state: SkeletonAnimationState | null,
  seat: Matrix4
): number | null => {
  const minifigRig = getMinifigRig(sampler.boneNames)
  if (minifigRig === null) return null
  const matrices = state === null ? sampler.restMatrices : sampler.getMatrices(state)
  const points = getPosedBonePoints(model, matrices)
    .filter((entry) => entry.boneIndex === minifigRig.torsoIndex)
    .map((entry) => entry.point.applyMatrix4(seat))
  return getSideways(new Box3().setFromPoints(points))
}

// The LDraw driver's torso (the drawing's holder of that part) on the seat, in the car's frame.
const getLDrawTorsoOffset = (drawing: DriverDrawing, scene: Scene): number | null => {
  scene.updateMatrixWorld(true)
  const figure = drawing.object.children[0]?.children[0]
  const torso = figure?.children[Object.values(MinifigPartKey).indexOf(MinifigPartKey.TORSO)]
  return torso === undefined ? null : getSideways(getVisibleBounds(torso))
}

const getRoundedOrNull = (value: number | null): number | null =>
  value === null ? null : getRounded(value)

// How far to the side the driver sits in a car, in each of the race's poses: the original's (its model on the seat point of the racer's
// appearance), the layer's LDraw driver given the same pose as the race gives it (and rendered once, for the census), and the steering
// wheel of the LDraw car's file.
export const measureDriverSeat = async (
  subject: DriverSeatSubject,
  drawing: DriverDrawing | null,
  render: (scene: Scene) => void
): Promise<readonly DriverSeatMeasurement[]> => {
  const { x, y, z } = subject.seatPoint
  const seat = new Matrix4().makeTranslation(x, y, z)
  const sampler = createSkeletonPoseSampler(subject.driverModel)
  const scene = new Scene()
  if (drawing !== null) {
    scene.add(drawing.object)
    drawing.applyPose({ matrix: seat, isVisible: true, animationState: null, opacity: 1 })
  }
  const isDrawn = drawing !== null && (await waitForStableMeshes(drawing.object))
  if (isDrawn) render(scene)
  const steeringWheelOffset =
    subject.ldrawCarText === null ? null : getSteeringWheelOffset(subject.ldrawCarText)
  const measurements = RACE_POSES.map((pose): DriverSeatMeasurement => {
    const state = sampler === null ? null : getPoseState(sampler, pose.clipIndex, pose.milliseconds)
    if (isDrawn)
      drawing.applyPose({ matrix: seat, isVisible: true, animationState: state, opacity: 1 })
    return Object.freeze({
      racer: subject.racer,
      pose: pose.name,
      seatOffset: getRounded(y * STUD_WIDTH),
      originalDriverOffset: getRoundedOrNull(
        sampler === null ? null : getOriginalTorsoOffset(subject.driverModel, sampler, state, seat)
      ),
      ldrawDriverOffset: getRoundedOrNull(isDrawn ? getLDrawTorsoOffset(drawing, scene) : null),
      steeringWheelOffset,
    })
  })
  drawing?.dispose()
  return measurements
}
