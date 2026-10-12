import { RACER_FIGURE_LEVEL_DISTANCE } from '@lego-games/lego-racers/race-presentation'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'

// LEGORacers.exe 0x0040e270 / GolDP.dll 0x100240b0: an object whose first level distance (squared) is smaller than the
// squared distance from the eye to its sphere centre is left out; the levels past the first have no model.
export const getIsWithinLevelDistance = (
  centre: Vector3Like | null,
  eye: Vector3Like,
  squaredLevelDistance: number = RACER_FIGURE_LEVEL_DISTANCE
): boolean => {
  if (centre === null) return true
  const squaredDistance =
    (eye.x - centre.x) * (eye.x - centre.x) +
    (eye.y - centre.y) * (eye.y - centre.y) +
    (eye.z - centre.z) * (eye.z - centre.z)
  return !(squaredLevelDistance < squaredDistance)
}
