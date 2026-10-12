import type { Vector3 } from '../../../simulation-math/index.ts'
import type { DecalView } from '../../types/race-presentation.types.ts'

// 0x00490330 projects the crane's shadow only while the camera is strictly within the instance's draw distance.
export const getIsDecalWithinDistance = (view: DecalView, eye: Vector3): boolean =>
  view.maximumSquaredDistance === null ||
  (eye.x - view.placement.position.x) ** 2 +
    (eye.y - view.placement.position.y) ** 2 +
    (eye.z - view.placement.position.z) ** 2 <
    view.maximumSquaredDistance
