import type {
  BspTreeInstance,
  MeshInstance,
  SkeletonInstance,
  WorldInstance,
} from '../../../world/index.ts'
import { getInstanceRotation } from '../../types/instance-rotation/instance-rotation.ts'
import { SceneInstanceKind } from '../../types/scene-enums/scene-enums.ts'
import { SceneLinkError } from '../../types/scene-errors/scene-errors.ts'
import type {
  SceneAnimation,
  SceneInstance,
  SceneInstanceKind as SceneInstanceKindValue,
  SceneInstanceLevel,
} from '../../types/scene.types.ts'
import type {
  DistanceLevel,
  InstanceLevelInput,
  MaterialAssignedInstance,
  SceneCounts,
  SortedLevel,
  SortedSkeletonLevel,
} from './link-instances.types.ts'

const MAXIMUM_LEVELS = 3
// The skeleton name table keys on eight characters (0x100283e0).
const CLIP_NAME_LENGTH = 8
// 0x10057330 and 0x100576e4: FLT_MAX.
const LARGEST_FLOAT = 3.4028234663852886e38

// GolDP.dll 0x1002e640: a distance below FLT_MAX is squared, else stays FLT_MAX.
const getSquaredDistance = (distance: number): number =>
  distance < LARGEST_FLOAT ? Math.fround(distance * distance) : LARGEST_FLOAT

// GolDP.dll 0x10027c50 and 0x10023940: a later level is inserted before the first stored level with a larger
// distance, shifting the rest up; slot 0 is set first by the instance's own setter (+0x50 or 0x10023490).
const getInsertedLevels = <Level extends DistanceLevel>(
  levels: readonly Level[],
  level: Level
): readonly Level[] => {
  const insertAt = levels.findIndex(
    (stored, index) => index < MAXIMUM_LEVELS - 1 && level.squaredDistance < stored.squaredDistance
  )
  return insertAt < 0
    ? [...levels, level]
    : [...levels.slice(0, insertAt), level, ...levels.slice(insertAt)]
}

const getSortedLevels = <Level extends DistanceLevel>(levels: readonly Level[]): readonly Level[] =>
  levels.reduce<readonly Level[]>(
    (sorted, level, index) => (index === 0 ? [level] : getInsertedLevels(sorted, level)),
    []
  )

const getMaterialAssignmentIndex = (index: number | undefined, counts: SceneCounts) => {
  if (index === undefined || index < 0) return null
  if (counts.materialAssignmentCount <= index) {
    throw new SceneLinkError('Illegal alt mat assign ref val')
  }
  return counts.materialAssignmentOffset + index
}

// At most three levels, ending before the first one the loop's break test finds absent.
const getUsedLevels = <Level>(
  levels: readonly Level[],
  getIsAbsent: (level: Level) => boolean
): readonly Level[] => {
  const present = levels.slice(0, MAXIMUM_LEVELS)
  const firstAbsent = present.findIndex(getIsAbsent)
  return firstAbsent < 0 ? present : present.slice(0, firstAbsent)
}

const getMaterialAssignmentIndices = (
  usedLevels: readonly unknown[],
  instance: MaterialAssignedInstance,
  counts: SceneCounts
): readonly (number | null)[] =>
  usedLevels.map((_level, index) =>
    getMaterialAssignmentIndex(instance.materialAssignmentIndices[index], counts)
  )

// GolDP.dll 0x1002e640 for one mesh or BSP tree instance. Levels stop at the first negative mesh index; the
// material assignment of slot i stays with slot i when the levels are reordered (only the models and
// distances move).
const getLinkedInstance = <Level extends InstanceLevelInput>(
  instance: WorldInstance<Level>,
  kind: SceneInstanceKindValue,
  counts: SceneCounts,
  getBspTreeIndex: (level: Level) => number | null
): SceneInstance => {
  const firstMeshIndex = instance.levels[0]?.meshIndex ?? -1
  if (counts.meshCount <= firstMeshIndex >>> 0) throw new SceneLinkError('Illegal mesh reference')
  const usedLevels = getUsedLevels(instance.levels, (level) => level.meshIndex < 0)
  const materialAssignmentIndices = getMaterialAssignmentIndices(usedLevels, instance, counts)
  const sortedLevels = getSortedLevels<SortedLevel>(
    usedLevels.map((level) =>
      Object.freeze({
        meshIndex: level.meshIndex,
        bspTreeIndex: getBspTreeIndex(level),
        squaredDistance: getSquaredDistance(level.distance),
      })
    )
  )
  const levels: readonly SceneInstanceLevel[] = sortedLevels.map((level, index) =>
    Object.freeze({
      meshIndex: counts.meshOffset + level.meshIndex,
      skeletonIndex: null,
      animationIndex: null,
      materialAssignmentIndex: materialAssignmentIndices[index] ?? null,
      bspTreeIndex: level.bspTreeIndex,
      squaredDistance: level.squaredDistance,
    })
  )
  return Object.freeze({
    name: instance.name,
    kind,
    worldPath: counts.worldPath,
    startClipIndex: null,
    levels: Object.freeze(levels),
    position: instance.position,
    rotation: getInstanceRotation(instance.forward, instance.up),
  })
}

export const linkMeshInstances = (
  instances: readonly MeshInstance[],
  counts: SceneCounts
): readonly SceneInstance[] =>
  instances.map((instance) =>
    getLinkedInstance(instance, SceneInstanceKind.MESH, counts, () => null)
  )

// BSP tree instances also check their tree index ("Illegal bsp tree reference").
export const linkBspTreeInstances = (
  instances: readonly BspTreeInstance[],
  counts: SceneCounts
): readonly SceneInstance[] =>
  instances.map((instance) => {
    const bspTreeIndex = instance.levels[0]?.bspTreeIndex ?? -1
    const linked = getLinkedInstance(
      instance,
      SceneInstanceKind.BSP_TREE,
      counts,
      (level) => counts.bspTreeOffset + level.bspTreeIndex
    )
    if (counts.bspTreeCount <= bspTreeIndex >>> 0) {
      throw new SceneLinkError('Illegal bsp tree reference')
    }
    return linked
  })

// The clip a skeleton instance starts (world keyword 0x35, 0x1002e640 near its end): a name is looked up among
// the clip names of the animation of the last level read, an index is taken as it is; a name that is not found
// or a negative index means no animation.
const getStartClipIndex = (
  instance: SkeletonInstance,
  animation: SceneAnimation | undefined
): number | null => {
  if (instance.keyword35Name !== '') {
    const name = instance.keyword35Name.slice(0, CLIP_NAME_LENGTH)
    const clipIndex =
      animation?.animation.clips.findIndex(
        (clip) => clip.name.slice(0, CLIP_NAME_LENGTH) === name
      ) ?? -1
    return clipIndex < 0 ? null : clipIndex
  }
  return instance.keyword35Index < 0 ? null : instance.keyword35Index
}

// GolDP.dll 0x1002e640 for one skeleton instance: levels stop at the first negative skeleton index, a negative
// mesh index (a camera's skeleton) is allowed, and a mesh or skeleton index at or past the list is an error.
export const linkSkeletonInstances = (
  instances: readonly SkeletonInstance[],
  counts: SceneCounts,
  animations: readonly SceneAnimation[]
): readonly SceneInstance[] =>
  instances.map((instance) => {
    const firstLevel = instance.levels[0]
    if (
      firstLevel !== undefined &&
      firstLevel.meshIndex >= 0 &&
      counts.meshCount <= firstLevel.meshIndex
    ) {
      throw new SceneLinkError('Illegal mesh reference')
    }
    if (counts.skeletonCount <= (firstLevel?.skeletonIndex ?? -1) >>> 0) {
      throw new SceneLinkError('Illegal skeleton reference')
    }
    const usedLevels = getUsedLevels(instance.levels, (level) => level.skeletonIndex < 0)
    const materialAssignmentIndices = getMaterialAssignmentIndices(usedLevels, instance, counts)
    const sortedLevels = getSortedLevels<SortedSkeletonLevel>(
      usedLevels.map((level) =>
        Object.freeze({
          meshIndex: level.meshIndex,
          skeletonIndex: level.skeletonIndex,
          animationIndex: level.animationIndex,
          squaredDistance: getSquaredDistance(level.distance),
        })
      )
    )
    const lastLevel = usedLevels[usedLevels.length - 1]
    const levels: readonly SceneInstanceLevel[] = sortedLevels.map((level, index) =>
      Object.freeze({
        meshIndex: level.meshIndex < 0 ? -1 : counts.meshOffset + level.meshIndex,
        skeletonIndex: counts.skeletonOffset + level.skeletonIndex,
        animationIndex: counts.animationOffset + level.animationIndex,
        materialAssignmentIndex: materialAssignmentIndices[index] ?? null,
        bspTreeIndex: null,
        squaredDistance: level.squaredDistance,
      })
    )
    return Object.freeze({
      name: instance.name,
      kind: SceneInstanceKind.SKELETON,
      worldPath: counts.worldPath,
      startClipIndex: getStartClipIndex(
        instance,
        lastLevel === undefined
          ? undefined
          : animations[counts.animationOffset + lastLevel.animationIndex]
      ),
      levels: Object.freeze(levels),
      position: instance.position,
      rotation: getInstanceRotation(instance.forward, instance.up),
    })
  })
