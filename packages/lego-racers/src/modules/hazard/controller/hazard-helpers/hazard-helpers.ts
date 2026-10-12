import { releaseEmitter, spawnEmitter } from '../../../emitter/index.ts'
import {
  findMeshInstanceIndex,
  getSkeletonInstanceBoneTranslation,
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
  HazardRacer,
  HazardSession,
  HazardSphere,
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

// The opening of an update: null while idle; otherwise the hazard, ended first when it was asked to end.
export const getActiveAfterEndRequest = (
  instance: HazardInstance,
  end: (instance: HazardInstance) => HazardInstance
): HazardInstance | null =>
  instance.lifecycle === HazardLifecycle.IDLE ? null : getUpdatedAfterEndRequest(instance, end)

export const getIsInsideAWindow = (
  time: number,
  windows: readonly (readonly [number, number])[]
): boolean => windows.some(([start, end]) => start < time && time < end)

// The End of the hazards that hold a track emitter: it is released and the hazard idle.
export const getIdleWithEmitterReleased = (
  instance: HazardInstance,
  session: HazardSession,
  emitterHandle: number | null
): HazardInstance => {
  releaseTrackEmitter(session, emitterHandle)
  return Object.freeze({ ...instance, lifecycle: HazardLifecycle.IDLE })
}

// Begin registers the shape with the collision registry and End ends the entry (+0x24 = 0); a hazard asked to end is
// still registered until its update runs End.
export const getSphereWhileRegistered = (
  instance: HazardInstance,
  sphere: HazardSphere
): HazardSphere | null =>
  instance.lifecycle === HazardLifecycle.ACTIVE || instance.lifecycle === HazardLifecycle.ENDING
    ? sphere
    : null

// 0x00411cc0 with the hazards' reading of a bone (0x0048e1c0, 0x0048da10, 0x0048cbb0): the shape moves to the bone's
// translation carried by the instance; an instance that is not there leaves it where it was.
export const getSphereOnBone = (
  session: HazardSession,
  reference: InstanceReference | null,
  boneIndex: number,
  sphere: HazardSphere
): HazardSphere => {
  const skeleton = getSkeletonInstance(session, reference)
  const centre =
    skeleton === null
      ? null
      : getSkeletonInstanceBoneTranslation(session.arithmetic, skeleton, boneIndex)
  return centre === null ? sphere : Object.freeze({ centre, radius: sphere.radius })
}

// The touch callbacks of the lava, the ghost and the crane act on a racer that is not spinning already and is moving
// (car body flags 0x6c0 bit 2 and forward speed +0x618, at racer +0xaa8 and +0xa00).
export const getIsRacerSpinnable = (racer: HazardRacer): boolean =>
  !racer.isSpinning && racer.forwardSpeed !== 0
