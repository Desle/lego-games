import { parseAnimation } from '../../../animation/index.ts'
import { getRacerFilePath } from '../../../racer-appearance/index.ts'
import { getSkeletalAnimation } from '../../../skeletal-animation/index.ts'
import { EMPTY_PROJECTILE_MODEL_DATA } from '../../types/projectile-model-data/projectile-model-data.ts'
import type { ProjectileModelData } from '../../types/race.types.ts'

const ROCKET_ANIMATION_NAME = 'DMISSILE'
const ROCKET_COUNT = 3

// 0x00456db0 starts the rocket's launch animation (rocket k plays clip k of the missile's animation) and 0x004568f0
// holds state 2 until the figure's clock reaches its last frame (0x0040e360: (frames - 1) <= time at the clip's rate).
const getRocketLaunchMilliseconds = (readFile: (path: string) => Uint8Array): readonly number[] => {
  const animation = getSkeletalAnimation(
    parseAnimation(readFile(getRacerFilePath(ROCKET_ANIMATION_NAME, 'ADB')))
  )
  return Object.freeze(
    Array.from({ length: ROCKET_COUNT }, (_, index) => {
      const clip = animation.clips[index]
      return clip === undefined ? 0 : (clip.frameCount - 1) / clip.framesPerMillisecond
    })
  )
}

// The model data the moving power-up effects read (projectiles.md).
export const loadProjectileModelData = (
  readFile: (path: string) => Uint8Array
): ProjectileModelData =>
  Object.freeze({
    ...EMPTY_PROJECTILE_MODEL_DATA,
    rocketLaunchMilliseconds: getRocketLaunchMilliseconds(readFile),
  })
