import { parseAnimation } from '../../../animation/index.ts'
import { getSkeletalAnimation } from '../../../skeletal-animation/index.ts'
import { parseSkeleton } from '../../../skeleton/index.ts'
import { getArchivePath, getNameWithDefaultExtension } from '../../types/scene-path/scene-path.ts'
import type { SceneAnimation, SceneSkeleton } from '../../types/scene.types.ts'
import type { SceneFileSource } from './load-scene.types.ts'

// 0x10017ac0 appends ".sdf" and ".adf" (the strings 0x1005cba4..0x1005cbd4) to these names; the readers'
// defaults ".sdb" (0x1005cef8) and ".adb" (0x1005cbdc) replace them.
const SKELETON_LIST_EXTENSION = '.sdf'
const SKELETON_EXTENSION = '.sdb'
const ANIMATION_LIST_EXTENSION = '.adf'
const ANIMATION_EXTENSION = '.adb'

// GolDP.dll 0x10029a20 for each name in the world's skeleton list.
export const linkSkeletons = (
  source: SceneFileSource,
  names: readonly string[]
): readonly SceneSkeleton[] =>
  Object.freeze(
    names.map((name) => {
      const path = getArchivePath(
        source.directory,
        getNameWithDefaultExtension(name + SKELETON_LIST_EXTENSION, SKELETON_EXTENSION)
      )
      return Object.freeze({ name, path, skeleton: parseSkeleton(source.archive.readFile(path)) })
    })
  )

// GolDP.dll 0x100188e0 for each name in the world's animation list.
export const linkAnimations = (
  source: SceneFileSource,
  names: readonly string[]
): readonly SceneAnimation[] =>
  Object.freeze(
    names.map((name) => {
      const path = getArchivePath(
        source.directory,
        getNameWithDefaultExtension(name + ANIMATION_LIST_EXTENSION, ANIMATION_EXTENSION)
      )
      return Object.freeze({
        name,
        path,
        animation: getSkeletalAnimation(parseAnimation(source.archive.readFile(path))),
      })
    })
  )
