import type { RaceWorlds } from '../../../world-animation/index.ts'
import type { CraneShadow } from '../../types/crane-shadow.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardRuntime } from '../../types/hazard-runtime.types.ts'

// 0x00490330 (the crane's draw slot): a crane that is not idle puts its shadow under the centre of its sphere (the bone its last update found) while the camera is within
// the instance's first draw distance (+0x84); the camera check is left to the caller, which knows the camera.
export const getCraneShadows = (
  runtime: HazardRuntime,
  worlds: Pick<RaceWorlds, 'track' | 'blended'>
): readonly CraneShadow[] =>
  runtime.instances.flatMap((hazard): readonly CraneShadow[] => {
    const { data } = hazard
    if (
      data.keyword !== HazardKeyword.HAZARD_32 ||
      hazard.lifecycle === HazardLifecycle.IDLE ||
      data.instance === null
    ) {
      return []
    }
    const instance = worlds[data.instance.world].skeletonInstances[data.instance.index]
    const maximumSquaredDistance = instance?.levelSquaredDistances[0]
    if (instance === undefined || maximumSquaredDistance === undefined) return []
    const bone = data.sphere.centre
    const { rotation } = instance
    return [
      Object.freeze({
        bone: Object.freeze({ x: bone[0], y: bone[1], z: bone[2] }),
        upHint: Object.freeze({ x: rotation[0], y: rotation[1], z: rotation[2] }),
        maximumSquaredDistance,
      }),
    ]
  })
