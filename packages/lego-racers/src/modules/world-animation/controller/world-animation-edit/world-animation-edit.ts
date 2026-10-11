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
