import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import type { StartPosition } from '../../../start-position/index.ts'
import {
  getMatrixFromQuaternion,
  getRotationFromFrameAxes,
  IDENTITY_MATRIX3,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { RigidBodyFrame } from '../../../racer-physics/index.ts'

const toVector = ([x, y, z]: readonly [number, number, number]): Vector3 =>
  Object.freeze({ x, y, z })

// Where a racer's car starts. A racer with a route starts at the route's first position and rotation (0x0042a670).
// Otherwise it takes its slot of the start grid: 0x0043b480 puts the slot's position on the car's frame (frame
// slot +0x08) and builds the rotation from the two axes (slot +0x40, getRotationFromFrameAxes). The slot is
// racer-setup's getStartSlot (racer set +0x26c); the car attach 0x00429210 copies the frame and adds no offset.
export const getStartFrame = (
  arithmetic: FloatArithmetic,
  startPositions: readonly StartPosition[],
  startSlot: number,
  route: ComputerRacerRoute | null
): RigidBodyFrame => {
  if (route !== null) {
    const [x, y, z, w] = route.firstQuaternion
    return Object.freeze({
      rotation: getMatrixFromQuaternion(arithmetic, { x, y, z, w }),
      position: toVector(route.firstVector),
    })
  }
  const slot = startPositions.find((candidate) => candidate.slot === startSlot)
  if (slot === undefined || slot.position === null) {
    return Object.freeze({ rotation: IDENTITY_MATRIX3, position: ZERO_VECTOR3 })
  }
  const { firstAxis, secondAxis } = slot
  return Object.freeze({
    rotation:
      firstAxis === null || secondAxis === null
        ? IDENTITY_MATRIX3
        : getRotationFromFrameAxes(arithmetic, {
            first: toVector(firstAxis),
            third: toVector(secondAxis),
          }),
    position: toVector(slot.position),
  })
}
