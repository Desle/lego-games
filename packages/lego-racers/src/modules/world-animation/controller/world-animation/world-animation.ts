import { createSkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import {
  createFloatArithmetic,
  getFrameAxes,
  getRotationFromFrameAxes,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import { getInstanceRotation } from '../../../scene/index.ts'
import type { Skeleton } from '../../../skeleton/index.ts'
import type {
  BspTreeInstance,
  MeshInstance,
  SkeletonInstance,
  SkeletonLevel,
  Sprite,
} from '../../../world/index.ts'
import type {
  InstanceLevel,
  MaterialAnimationRuntime,
  MaterialAnimationTarget,
  MaterialSlotWrite,
  MeshInstanceRuntime,
  PositionedInstance,
  SkeletonInstanceRuntime,
  WorldAnimation,
  WorldAnimationInput,
} from '../../types/world-animation.types.ts'
import {
  getAdvancedMaterialPlayback,
  getStartedMaterialPlayback,
  IDLE_MATERIAL_PLAYBACK,
} from '../material-animation-playback/material-animation-playback.ts'
import { advanceSkeletonInstance } from '../skeleton-instance/skeleton-instance.ts'
import { createTextureScroll, getAdvancedTextureScroll } from '../texture-scroll/texture-scroll.ts'

// GolDP.dll 0x10057330 and 0x100576e4: FLT_MAX, the distance of a level that is always shown.
const LARGEST_FLOAT = 3.4028234663852886e38
const LEVEL_COUNT = 3
// The world's keywords 0x42 and 0x4c set flags 2 and 4 of the instance (0x1002e640).
// 0x100234c0 (the instance's level set-up) ORs 1 into +0x5c for every level the loader sets up.
const FLAG_LEVEL_SET_UP = 1
const FLAG_KEYWORD_42 = 2
const FLAG_KEYWORD_4C = 4
// The skeleton name table keys on eight characters (0x100283e0).
const CLIP_NAME_LENGTH = 8

// 0x1002e640: a distance below FLT_MAX is squared, else stays FLT_MAX.
const getSquaredDistance = (distance: number): number =>
  distance < LARGEST_FLOAT ? Math.fround(distance * distance) : LARGEST_FLOAT

// 0x10027c50 and 0x10023940: a later level goes before the first stored level with a larger distance; the first
// stored level of the three keeps its place if the list is full.
const getSortedLevels = (levels: readonly InstanceLevel[]): readonly InstanceLevel[] =>
  levels.reduce<readonly InstanceLevel[]>((sorted, level, index) => {
    if (index === 0) return [level]
    const insertAt = sorted.findIndex(
      (stored, position) =>
        position < LEVEL_COUNT - 1 && level.squaredDistance < stored.squaredDistance
    )
    return insertAt < 0
      ? [...sorted, level]
      : [...sorted.slice(0, insertAt), level, ...sorted.slice(insertAt)]
  }, [])

const getLevelDistances = (levels: readonly InstanceLevel[]): readonly number[] =>
  Object.freeze(
    Array.from(
      { length: LEVEL_COUNT },
      (_, index) => getSortedLevels(levels)[index]?.squaredDistance ?? LARGEST_FLOAT
    )
  )

const getFlags = (instance: MeshInstance | SkeletonInstance): number =>
  (instance.isKeyword42Set ? FLAG_KEYWORD_42 : 0) | (instance.isKeyword4cSet ? FLAG_KEYWORD_4C : 0)

// The clip world keyword 0x35 starts (0x1002e640 near the end): a name is looked up among the clip names of the
// animation of the last level, an index is taken as it is; none found or a negative index means no clip.
const getStartClipIndex = (
  instance: SkeletonInstance,
  lastAnimation: SkeletalAnimation | undefined
): number | null => {
  if (instance.keyword35Name !== '') {
    const name = instance.keyword35Name.slice(0, CLIP_NAME_LENGTH)
    const index =
      lastAnimation?.clips.findIndex((clip) => clip.name.slice(0, CLIP_NAME_LENGTH) === name) ?? -1
    return index < 0 ? null : index
  }
  return instance.keyword35Index < 0 ? null : instance.keyword35Index
}

const getUsedSkeletonLevels = (instance: SkeletonInstance): readonly SkeletonLevel[] => {
  const present = instance.levels.slice(0, LEVEL_COUNT)
  const firstAbsent = present.findIndex((level) => level.skeletonIndex < 0)
  return firstAbsent < 0 ? present : present.slice(0, firstAbsent)
}

const createSkeletonInstance = (
  instance: SkeletonInstance,
  animations: readonly SkeletalAnimation[],
  skeletons: readonly Skeleton[],
  meshScales: readonly number[],
  meshRadii: readonly number[]
): SkeletonInstanceRuntime => {
  const used = getUsedSkeletonLevels(instance)
  const levels = used.map((level): InstanceLevel => ({
    animationIndex: level.animationIndex,
    skeletonIndex: level.skeletonIndex,
    meshIndex: level.meshIndex,
    squaredDistance: getSquaredDistance(level.distance),
  }))
  const nearest = getSortedLevels(levels)[0]
  const animation = nearest === undefined ? null : (animations[nearest.animationIndex] ?? null)
  const lastLevel = used[used.length - 1]
  const startClipIndex = getStartClipIndex(
    instance,
    lastLevel === undefined ? undefined : animations[lastLevel.animationIndex]
  )
  const clip =
    animation === null || startClipIndex === null || animation.clips[startClipIndex] === undefined
      ? null
      : createSkeletonAnimationState(animation, startClipIndex)
  return Object.freeze({
    name: instance.name,
    animation,
    rotation: getInstanceRotation(instance.forward, instance.up),
    scale: meshScales[nearest?.meshIndex ?? -1] ?? 1,
    boundsRadius: meshRadii[nearest?.meshIndex ?? -1] ?? 0,
    skeleton: nearest === undefined ? null : (skeletons[nearest.skeletonIndex] ?? null),
    clip,
    isAnimated: clip !== null,
    otherFlags: getFlags(instance) | (used.length > 0 ? FLAG_LEVEL_SET_UP : 0),
    position: Object.freeze([
      instance.position.x,
      instance.position.y,
      instance.position.z,
    ] as const),
    levelSquaredDistances: getLevelDistances(levels),
    textureScroll: createTextureScroll(instance.keyword3fValues),
  })
}

const createMeshInstance = (instance: MeshInstance): MeshInstanceRuntime =>
  Object.freeze({
    name: instance.name,
    position: Object.freeze([
      instance.position.x,
      instance.position.y,
      instance.position.z,
    ] as const),
    levelSquaredDistances: getLevelDistances(
      instance.levels
        .slice(0, LEVEL_COUNT)
        .filter((level) => level.meshIndex >= 0)
        .map((level) => ({
          animationIndex: -1,
          skeletonIndex: -1,
          meshIndex: level.meshIndex,
          squaredDistance: getSquaredDistance(level.distance),
        }))
    ),
    otherFlags: getFlags(instance),
    textureScroll: createTextureScroll(instance.keyword3fValues),
  })

// 0x1002e640 starts every material animation entry an instance refers to, looping, and hands it the level's material
// table and the slot (0x10025da0 overwrites both: the last reference to an entry wins); so does 0x1002e250 for the
// entry a sprite names (keyword 0x3e), whose target is the sprite's own (not an instance: null here).
const createMaterialAnimations = (
  names: readonly string[],
  definitions: WorldAnimationInput['materialAnimations'],
  instances: readonly (SkeletonInstance | MeshInstance | BspTreeInstance)[],
  sprites: readonly Sprite[]
): readonly MaterialAnimationRuntime[] =>
  definitions.map((definition, animationIndex) => {
    const targets = new Map<number, MaterialAnimationTarget | null>()
    for (const instance of instances) {
      for (const reference of instance.materialAnimationReferences) {
        if (reference.materialAnimationIndex !== animationIndex) continue
        targets.set(
          reference.entryIndex,
          Object.freeze({
            instanceName: instance.name,
            levelIndex: reference.levelIndex,
            slot: reference.value,
          })
        )
      }
    }
    for (const sprite of sprites) {
      if (sprite.materialAnimation?.materialAnimationIndex !== animationIndex) continue
      targets.set(sprite.materialAnimation.entryIndex, null)
    }
    return Object.freeze({
      name: names[animationIndex] ?? '',
      definition,
      entries: Object.freeze(
        definition.entries.map((_, entryIndex) => {
          const target = targets.get(entryIndex)
          return target === undefined
            ? IDLE_MATERIAL_PLAYBACK
            : Object.freeze({
                ...getStartedMaterialPlayback(IDLE_MATERIAL_PLAYBACK, true),
                target,
              })
        })
      ),
    })
  })

// 0x00413310 (from World_Mirror 0x00416140): the rotation's first and third rows are read back, their y is negated
// and the rotation is built again from them (0x00410900).
const getMirroredRotation = (rotation: Matrix3): Matrix3 => {
  const { first, third } = getFrameAxes(rotation)
  return getRotationFromFrameAxes(createFloatArithmetic(RACE_FPU_PRECISION), {
    first: Object.freeze({ ...first, y: -first.y }),
    third: Object.freeze({ ...third, y: -third.y }),
  })
}

// LEGORacers.exe 0x004104c0 writes the row a playing entry selects into its target's slot (0x00410750); the writes of a
// frame in the order the world runs the entries (0x00410300 per animation, then each entry), so a later entry
// overwrites an earlier one that shares a slot.
export const getMaterialSlotWrites = (world: WorldAnimation): readonly MaterialSlotWrite[] =>
  world.materialAnimations.flatMap((animation) =>
    animation.entries.flatMap((playback) => {
      const materialName =
        playback.tableIndex === null
          ? undefined
          : animation.definition.materials[playback.tableIndex]?.materialName
      return playback.target === null || materialName === undefined
        ? []
        : [Object.freeze({ ...playback.target, materialName })]
    })
  )

// World_LinkInstances 0x1002e640 as far as the race moves things: the skeleton instances with their starting
// clips, the mesh instances' positions and level distances, and the material animation entries instances play.
export const createWorldAnimation = (input: WorldAnimationInput): WorldAnimation => {
  const { world } = input
  const getMirrored = <Instance extends PositionedInstance>(instance: Instance): Instance =>
    input.isMirrored === true
      ? Object.freeze({
          ...instance,
          isMirrored: true,
          position: Object.freeze([
            instance.position[0],
            -instance.position[1],
            instance.position[2],
          ] as const),
        })
      : instance
  const getMirroredSkeletonRotation = (
    instance: SkeletonInstanceRuntime
  ): SkeletonInstanceRuntime =>
    input.isMirrored === true
      ? Object.freeze({ ...instance, rotation: getMirroredRotation(instance.rotation) })
      : instance
  return Object.freeze({
    cameras: Object.freeze(
      world.cameras.map((camera) =>
        Object.freeze({
          name: camera.name,
          skeletonInstanceIndex: camera.skeletonInstanceIndex,
          boneIndex: camera.keyword2fValue,
        })
      )
    ),
    skeletonInstances: Object.freeze(
      world.skeletonInstances.map((instance) =>
        getMirrored(
          getMirroredSkeletonRotation(
            createSkeletonInstance(
              instance,
              input.animations,
              input.skeletons ?? [],
              input.meshScales ?? [],
              input.meshRadii ?? []
            )
          )
        )
      )
    ),
    meshInstances: Object.freeze(
      world.meshInstances.map((instance) => getMirrored(createMeshInstance(instance)))
    ),
    materialAnimations: createMaterialAnimations(
      world.materialAnimations,
      input.materialAnimations,
      [...world.meshInstances, ...world.skeletonInstances, ...world.bspTreeInstances],
      world.sprites
    ),
  })
}

// An empty world: what a race without a world file has.
export const EMPTY_WORLD_ANIMATION: WorldAnimation = Object.freeze({
  cameras: Object.freeze([]),
  skeletonInstances: Object.freeze([]),
  meshInstances: Object.freeze([]),
  materialAnimations: Object.freeze([]),
})

// LEGORacers.exe 0x00416090: the world's material animations, its mesh instances (which only scroll their textures; the
// velocity nobody sets) and its skeleton instances advance by the milliseconds.
export const advanceWorldAnimation = (
  world: WorldAnimation,
  milliseconds: number
): WorldAnimation =>
  Object.freeze({
    ...world,
    materialAnimations: Object.freeze(
      world.materialAnimations.map((animation) =>
        Object.freeze({
          ...animation,
          entries: Object.freeze(
            animation.entries.map((playback, entryIndex) =>
              getAdvancedMaterialPlayback(animation.definition, entryIndex, playback, milliseconds)
            )
          ),
        })
      )
    ),
    meshInstances: Object.freeze(
      world.meshInstances.map((instance) =>
        Object.freeze({
          ...instance,
          textureScroll: getAdvancedTextureScroll(instance.textureScroll, milliseconds),
        })
      )
    ),
    skeletonInstances: Object.freeze(
      world.skeletonInstances.map((instance) => advanceSkeletonInstance(instance, milliseconds))
    ),
  })

export const findSkeletonInstanceIndex = (world: WorldAnimation, name: string): number => {
  const key = name.slice(0, CLIP_NAME_LENGTH)
  return world.skeletonInstances.findIndex(
    (instance) => instance.name.slice(0, CLIP_NAME_LENGTH) === key
  )
}

export const findCameraIndex = (world: WorldAnimation, name: string): number => {
  const key = name.slice(0, CLIP_NAME_LENGTH)
  return world.cameras.findIndex((camera) => camera.name.slice(0, CLIP_NAME_LENGTH) === key)
}

export const findMeshInstanceIndex = (world: WorldAnimation, name: string): number => {
  const key = name.slice(0, CLIP_NAME_LENGTH)
  return world.meshInstances.findIndex(
    (instance) => instance.name.slice(0, CLIP_NAME_LENGTH) === key
  )
}

export const findMaterialAnimationIndex = (world: WorldAnimation, name: string): number => {
  const key = name.slice(0, CLIP_NAME_LENGTH)
  return world.materialAnimations.findIndex(
    (animation) => animation.name.slice(0, CLIP_NAME_LENGTH) === key
  )
}
