import {
  findMeshInstanceIndex,
  findSkeletonInstanceIndex,
} from '../world-animation/world-animation.ts'
import type {
  MaterialAnimationPlayback,
  MeshInstanceRuntime,
  SkeletonInstanceRuntime,
  WorldAnimation,
} from '../../types/world-animation.types.ts'

const getReplaced = <Item>(
  items: readonly Item[],
  index: number,
  replacement: Item
): readonly Item[] =>
  Object.freeze(items.map((item, position) => (position === index ? replacement : item)))

export const getWorldWithSkeletonInstance = (
  world: WorldAnimation,
  index: number,
  instance: SkeletonInstanceRuntime
): WorldAnimation =>
  Object.freeze({
    ...world,
    skeletonInstances: getReplaced(world.skeletonInstances, index, instance),
  })

export const getWorldWithMeshInstance = (
  world: WorldAnimation,
  index: number,
  instance: MeshInstanceRuntime
): WorldAnimation =>
  Object.freeze({ ...world, meshInstances: getReplaced(world.meshInstances, index, instance) })

// A material animation entry\'s rate (+0xc), written by the code lock\'s loader (0x0048d300).
export const getWorldWithMaterialRate = (
  world: WorldAnimation,
  animationIndex: number,
  entryIndex: number,
  rate: number
): WorldAnimation => {
  const animation = world.materialAnimations[animationIndex]
  const entry = animation?.definition.entries[entryIndex]
  if (animation === undefined || entry === undefined) return world
  return Object.freeze({
    ...world,
    materialAnimations: getReplaced(
      world.materialAnimations,
      animationIndex,
      Object.freeze({
        ...animation,
        definition: Object.freeze({
          ...animation.definition,
          entries: getReplaced(animation.definition.entries, entryIndex, {
            ...entry,
            keyword2aValue: rate,
          }),
        }),
      })
    ),
  })
}

export const getWorldWithMaterialPlayback = (
  world: WorldAnimation,
  animationIndex: number,
  entryIndex: number,
  playback: MaterialAnimationPlayback
): WorldAnimation => {
  const animation = world.materialAnimations[animationIndex]
  if (animation === undefined) return world
  return Object.freeze({
    ...world,
    materialAnimations: getReplaced(
      world.materialAnimations,
      animationIndex,
      Object.freeze({ ...animation, entries: getReplaced(animation.entries, entryIndex, playback) })
    ),
  })
}

// The level distances (+0x84, +0x88, +0x8c) of the instance with this name: the world's mesh instances are looked up first,
// then its skeleton instances (0x004119a0 on the lists at world +0xb4 and +0xc0, as 0x00461070 does for a 53 event). Null
// when the world has neither.
export const getInstanceLevelDistances = (
  world: WorldAnimation,
  name: string
): readonly number[] | null => {
  const meshIndex = findMeshInstanceIndex(world, name)
  if (meshIndex >= 0) return world.meshInstances[meshIndex]?.levelSquaredDistances ?? null
  const skeletonIndex = findSkeletonInstanceIndex(world, name)
  return skeletonIndex >= 0
    ? (world.skeletonInstances[skeletonIndex]?.levelSquaredDistances ?? null)
    : null
}

export const getWorldWithInstanceLevelDistances = (
  world: WorldAnimation,
  name: string,
  levelSquaredDistances: readonly number[]
): WorldAnimation => {
  const distances = Object.freeze([...levelSquaredDistances])
  const meshIndex = findMeshInstanceIndex(world, name)
  const mesh = world.meshInstances[meshIndex]
  if (mesh !== undefined) {
    return getWorldWithMeshInstance(world, meshIndex, { ...mesh, levelSquaredDistances: distances })
  }
  const skeletonIndex = findSkeletonInstanceIndex(world, name)
  const skeleton = world.skeletonInstances[skeletonIndex]
  return skeleton === undefined
    ? world
    : getWorldWithSkeletonInstance(world, skeletonIndex, {
        ...skeleton,
        levelSquaredDistances: distances,
      })
}
