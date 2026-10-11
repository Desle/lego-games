import { releaseEmitter, spawnEmitter } from '../../../emitter/index.ts'
import {
  findMeshInstanceIndex,
  findSkeletonInstanceIndex,
  getWorldWithMaterialPlayback,
  getWorldWithMeshInstance,
  getWorldWithSkeletonInstance,
} from '../../../world-animation/index.ts'
import type {
  MaterialAnimationPlayback,
  MeshInstanceRuntime,
  SkeletonInstanceRuntime,
} from '../../../world-animation/index.ts'
import type {
  HazardInstance,
  HazardSession,
  HazardWorldKey,
  InstanceReference,
} from '../../types/hazard-runtime.types.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'

// The identifier of a hazard that no signal can start (+0x08 = -1).
export const NO_IDENTIFIER = -1

// A skeleton instance of a world by name (the world's table at +0xc0), or null.
export const findSkeletonReference = (
  session: HazardSession,
  world: HazardWorldKey,
  name: string
): InstanceReference | null => {
  const index = findSkeletonInstanceIndex(session.getWorld(world), name)
  return index < 0 ? null : Object.freeze({ world, kind: 'skeleton', index })
}

// A mesh instance of a world by name (the world's table at +0xb4), or null.
export const findMeshReference = (
  session: HazardSession,
  world: HazardWorldKey,
  name: string
): InstanceReference | null => {
  const index = findMeshInstanceIndex(session.getWorld(world), name)
  return index < 0 ? null : Object.freeze({ world, kind: 'mesh', index })
}

export const getSkeletonInstance = (
  session: HazardSession,
  reference: InstanceReference | null
): SkeletonInstanceRuntime | null =>
  reference === null
    ? null
    : (session.getWorld(reference.world).skeletonInstances[reference.index] ?? null)

export const getMeshInstance = (
  session: HazardSession,
  reference: InstanceReference | null
): MeshInstanceRuntime | null =>
  reference === null
    ? null
    : (session.getWorld(reference.world).meshInstances[reference.index] ?? null)

export const setSkeletonInstance = (
  session: HazardSession,
  reference: InstanceReference | null,
  instance: SkeletonInstanceRuntime
): void => {
  if (reference === null) return
  session.setWorld(
    reference.world,
    getWorldWithSkeletonInstance(session.getWorld(reference.world), reference.index, instance)
  )
}

export const setMeshInstance = (
  session: HazardSession,
  reference: InstanceReference | null,
  instance: MeshInstanceRuntime
): void => {
  if (reference === null) return
  session.setWorld(
    reference.world,
    getWorldWithMeshInstance(session.getWorld(reference.world), reference.index, instance)
  )
}

export const getWithLifecycle = (instance: HazardInstance, lifecycle: number): HazardInstance =>
  Object.freeze({ ...instance, lifecycle })

export const getWithData = (
  instance: HazardInstance,
  data: HazardInstance['data']
): HazardInstance => Object.freeze({ ...instance, data })

// Hazard_Update helper 0x0048a460: a hazard asked to end (state 3) ends at its next update.
export const getUpdatedAfterEndRequest = (
  instance: HazardInstance,
  end: (instance: HazardInstance) => HazardInstance
): HazardInstance => (instance.lifecycle === HazardLifecycle.ENDING ? end(instance) : instance)

// A material animation entry of a world, or null when the world has no such entry.
export const getMaterialPlayback = (
  session: HazardSession,
  world: HazardWorldKey,
  animationIndex: number,
  entryIndex: number
): MaterialAnimationPlayback | null =>
  session.getWorld(world).materialAnimations[animationIndex]?.entries[entryIndex] ?? null

export const changeMaterialPlayback = (
  session: HazardSession,
  world: HazardWorldKey,
  animationIndex: number,
  entryIndex: number,
  change: (playback: MaterialAnimationPlayback) => MaterialAnimationPlayback
): void => {
  const playback = getMaterialPlayback(session, world, animationIndex, entryIndex)
  if (playback === null) return
  session.setWorld(
    world,
    getWorldWithMaterialPlayback(
      session.getWorld(world),
      animationIndex,
      entryIndex,
      change(playback)
    )
  )
}

// The level distances of a skeleton or mesh instance (+0x84, +0x88, +0x8c), or null when it was not found.
export const getInstanceDistances = (
  session: HazardSession,
  reference: InstanceReference | null
): readonly number[] | null =>
  reference?.kind === 'mesh'
    ? (getMeshInstance(session, reference)?.levelSquaredDistances ?? null)
    : (getSkeletonInstance(session, reference)?.levelSquaredDistances ?? null)

export const setInstanceDistances = (
  session: HazardSession,
  reference: InstanceReference | null,
  distances: readonly number[]
): void => {
  const levelSquaredDistances = Object.freeze([...distances])
  if (reference?.kind === 'mesh') {
    const mesh = getMeshInstance(session, reference)
    if (mesh !== null) setMeshInstance(session, reference, { ...mesh, levelSquaredDistances })
    return
  }
  const skeleton = getSkeletonInstance(session, reference)
  if (skeleton !== null) {
    setSkeletonInstance(session, reference, { ...skeleton, levelSquaredDistances })
  }
}

// 0x00489d70 on the track's emitter pool (race +0x248c): the handle of a new emitter, or null when the race has no
// pool, no free handle or no free emitter.
export const spawnTrackEmitter = (session: HazardSession, name: string): number | null => {
  const pool = session.getEmitters()
  if (pool === null) return null
  const spawn = spawnEmitter(session.arithmetic, pool, name, { position: null, orientation: null })
  session.setEmitters(spawn.pool)
  return spawn.handleIndex
}

// 0x00489f30: the hazard lets go of its emitter; the particles alive finish their lives.
export const releaseTrackEmitter = (session: HazardSession, handleIndex: number | null): void => {
  const pool = session.getEmitters()
  if (pool !== null && handleIndex !== null) session.setEmitters(releaseEmitter(pool, handleIndex))
}
