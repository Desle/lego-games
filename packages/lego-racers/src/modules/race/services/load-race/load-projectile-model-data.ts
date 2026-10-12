import { getModelBounds, parseModel } from '../../../model/index.ts'
import type { ModelBounds } from '../../../model/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { Checkpoint } from '../../../checkpoint/index.ts'
import type { RouteNode } from '../../../projectiles/index.ts'
import { parseAnimation } from '../../../animation/index.ts'
import { getRacerFilePath } from '../../../racer-appearance/index.ts'
import {
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletalAnimation,
  getSkeletonPose,
} from '../../../skeletal-animation/index.ts'
import { parseSkeleton } from '../../../skeleton/index.ts'
import type { DebrisAnimations, RocketLaunchBone } from '../../../projectiles/index.ts'
import { EMPTY_PROJECTILE_MODEL_DATA } from '../../types/projectile-model-data/projectile-model-data.ts'
import type { ProjectileModelData } from '../../types/race.types.ts'

const ROCKET_ANIMATION_NAME = 'DMISSILE'
const ROCKET_COUNT = 3
// The four debris models "brick1".."brick4" of POWERUP.WDB all play the clips of this animation (2BRK02.ADB).
const DEBRIS_ANIMATION_NAME = '2BRK02'
const DEBRIS_MODEL_COUNT = 4

// 0x004514b0 plays clip (thrown count mod clip count) from its first frame and 0x00451860 frees the piece when the
// figure's clock reaches the clip's last frame (0x0040e360: (frames - 1) <= time at the clip's rate).
const getDebrisAnimations = (readFile: (path: string) => Uint8Array): DebrisAnimations => {
  const animation = getSkeletalAnimation(
    parseAnimation(readFile(getRacerFilePath(DEBRIS_ANIMATION_NAME, 'ADB')))
  )
  const clipMilliseconds = Object.freeze(
    animation.clips.map((clip) => (clip.frameCount - 1) / clip.framesPerMillisecond)
  )
  return Object.freeze(Array.from({ length: DEBRIS_MODEL_COUNT }, () => clipMilliseconds))
}

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

// 0x00456db0 reads node 1 of the missile skeleton once the clip has played to its last frame: rows 0 and 2 of its matrix
// are the axes and row 3 its position, in the model's units.
const LAUNCH_BONE_INDEX = 1
const MATRIX_SIZE = 16

const getRocketLaunchBones = (
  readFile: (path: string) => Uint8Array
): readonly RocketLaunchBone[] => {
  const skeleton = parseSkeleton(readFile(getRacerFilePath(ROCKET_ANIMATION_NAME, 'SDB')))
  const animation = getSkeletalAnimation(
    parseAnimation(readFile(getRacerFilePath(ROCKET_ANIMATION_NAME, 'ADB')))
  )
  return Object.freeze(
    Array.from({ length: ROCKET_COUNT }, (_, index) => {
      const clip = animation.clips[index]
      const first = createSkeletonAnimationState(animation, index)
      const state = Object.freeze({
        ...first,
        isLooping: false,
        clip: Object.freeze({ ...first.clip, timeInFrames: (clip?.frameCount ?? 1) - 1 }),
      })
      const matrices = getBoneMatrices(
        skeleton,
        getSkeletonPose(getRestPose(skeleton), animation, state)
      )
      const getRow = (row: number): Vector3 => {
        const start = LAUNCH_BONE_INDEX * MATRIX_SIZE + row * 4
        return Object.freeze({
          x: matrices[start] ?? 0,
          y: matrices[start + 1] ?? 0,
          z: matrices[start + 2] ?? 0,
        })
      }
      return Object.freeze({ position: getRow(3), firstAxis: getRow(0), thirdAxis: getRow(2) })
    })
  )
}

const NO_BOUNDS: ModelBounds = Object.freeze({
  centre: Object.freeze({ x: 0, y: 0, z: 0 }),
  radius: 0,
})

const getBounds = (
  arithmetic: FloatArithmetic,
  readFile: (path: string) => Uint8Array,
  name: string
): ModelBounds =>
  getModelBounds(arithmetic, parseModel(readFile(getRacerFilePath(name, 'GDB')))) ?? NO_BOUNDS

// The model data the moving power-up effects read (projectiles.md).
// The race's route (racer set +0x10, entries of 0x24 bytes from 0x0041e940) is its checkpoint list: a plane, a point and
// the next entry (the first link, byte +0x20).
const getRouteNodes = (checkpoints: readonly Checkpoint[]): readonly RouteNode[] =>
  Object.freeze(
    checkpoints.map((checkpoint) =>
      Object.freeze({
        normal: Object.freeze({
          x: checkpoint.plane[0],
          y: checkpoint.plane[1],
          z: checkpoint.plane[2],
        }),
        planeOffset: checkpoint.plane[3],
        position: Object.freeze({
          x: checkpoint.point[0],
          y: checkpoint.point[1],
          z: checkpoint.point[2],
        }),
        nextIndex: checkpoint.links[0] ?? 0,
      })
    )
  )

export const loadProjectileModelData = (
  arithmetic: FloatArithmetic,
  readFile: (path: string) => Uint8Array,
  checkpoints: readonly Checkpoint[]
): ProjectileModelData =>
  Object.freeze({
    ...EMPTY_PROJECTILE_MODEL_DATA,
    routeNodes: getRouteNodes(checkpoints),
    shapeBounds: Object.freeze({
      grapple: getBounds(arithmetic, readFile, 'GRAPPLE'),
      barrel: getBounds(arithmetic, readFile, 'BARREL'),
      rocket: getBounds(arithmetic, readFile, 'DMISSILE'),
    }),
    rocketLaunchMilliseconds: getRocketLaunchMilliseconds(readFile),
    debrisAnimations: getDebrisAnimations(readFile),
    rocketLaunchBones: getRocketLaunchBones(readFile),
    rocketModelScale: parseModel(readFile(getRacerFilePath(ROCKET_ANIMATION_NAME, 'GDB'))).scale,
  })
