import type { SceneInstance } from '@lego-games/lego-racers/scene'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
  getTransformedNormals,
  getTransformedPositions,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { BufferAttribute } from 'three'
import { createBatchGeometry } from './batch-geometry.ts'
import { LIT_MATERIAL_KEY } from './vertex-lighting.ts'
import type { LitMaterial } from './vertex-lighting.types.ts'
import {
  createBatchMesh,
  createInstanceGroup,
  getBatchMaterial,
  registerSlotMesh,
} from './instance-batches.ts'
import type {
  InstanceLevelMesh,
  InstanceObject,
  SceneObjectContext,
  SkeletonBatch,
  SkeletonBatchMesh,
} from './scene-object.types.ts'

// The clip a skeleton instance plays when the world names none. The game's own code picks the clip of the
// menu scenes' characters (not traced); the viewer plays the first one so they are not frozen.
const DEFAULT_CLIP_INDEX = 0

// A batch of a skeleton instance has its own geometry, because the bones move its vertices every update.
const createSkeletonBatch = (
  context: SceneObjectContext,
  levelMesh: InstanceLevelMesh,
  batchIndex: number
): SkeletonBatchMesh | null => {
  const sceneBatch = levelMesh.mesh.drawBatches[batchIndex]
  if (sceneBatch === undefined) return null
  const batchMaterial = getBatchMaterial(context, levelMesh, sceneBatch)
  if (batchMaterial === null) return null
  const geometry = createBatchGeometry(
    levelMesh.mesh,
    sceneBatch,
    batchMaterial.sceneMaterial.renderState,
    batchMaterial.sceneMaterial.ambientColor
  )
  const { renderState, ambientColor, diffuseColor } = batchMaterial.sceneMaterial
  if (
    levelMesh.mesh.colors === null &&
    levelMesh.mesh.normals !== null &&
    !renderState.isDiffuseWhite
  ) {
    const litMaterial: LitMaterial = {
      ambient: [ambientColor[0], ambientColor[1], ambientColor[2]],
      diffuse: [diffuseColor[0], diffuseColor[1], diffuseColor[2]],
    }
    geometry.userData[LIT_MATERIAL_KEY] = litMaterial
  }
  const positions = geometry.getAttribute('position') as BufferAttribute
  const normals = geometry.getAttribute('normal') as BufferAttribute | undefined
  const mesh = createBatchMesh(context, geometry, batchMaterial.material)
  registerSlotMesh(context, levelMesh, sceneBatch, mesh)
  // The bones move the vertices outside the bounds computed from the rest pose.
  mesh.frustumCulled = false
  return {
    mesh,
    batch: {
      geometry,
      transformIndices: sceneBatch.transformIndices,
      restPositions: Float32Array.from(positions.array),
      restNormals: normals === undefined ? null : Float32Array.from(normals.array),
    },
  }
}

const setBatchVertices = (batch: SkeletonBatch, matrices: Float32Array): void => {
  const positions = batch.geometry.getAttribute('position') as BufferAttribute
  positions.array.set(
    getTransformedPositions(batch.restPositions, batch.transformIndices, matrices)
  )
  positions.needsUpdate = true
  const normals = batch.geometry.getAttribute('normal') as BufferAttribute | undefined
  if (normals !== undefined && batch.restNormals !== null) {
    normals.array.set(getTransformedNormals(batch.restNormals, batch.transformIndices, matrices))
    normals.needsUpdate = true
  }
}

// A skeleton instance (world section 0x2f): its mesh's vertices follow the bone matrices of the pose the
// instance's animation gives at each update (GolDP.dll 0x10023b10, 0x10023580, 0x10014c20). Root motion
// (0x10027f40) is not applied, so a prop that travels stays in view.
export const createSkeletonInstanceObject = (
  context: SceneObjectContext,
  instance: SceneInstance,
  levelMesh: InstanceLevelMesh
): InstanceObject | null => {
  const { scene } = context
  const skeleton = scene.skeletons[levelMesh.level.skeletonIndex ?? -1]?.skeleton
  const animation = scene.animations[levelMesh.level.animationIndex ?? -1]?.animation
  if (skeleton === undefined || animation === undefined) return null
  const group = createInstanceGroup(instance, levelMesh.mesh.path, context.isBackground)
  const batches = levelMesh.mesh.drawBatches.flatMap((_batch, batchIndex) => {
    const created = createSkeletonBatch(context, levelMesh, batchIndex)
    if (created === null) return []
    group.add(created.mesh)
    return [created.batch]
  })
  const restPose = getRestPose(skeleton)
  const clipIndex = instance.startClipIndex ?? DEFAULT_CLIP_INDEX
  let state: SkeletonAnimationState | null =
    animation.clips[clipIndex] === undefined
      ? null
      : createSkeletonAnimationState(animation, clipIndex)
  const applyPose = () => {
    const pose = state === null ? restPose : getSkeletonPose(restPose, animation, state)
    const matrices = getBoneMatrices(skeleton, pose)
    for (const batch of batches) setBatchVertices(batch, matrices)
  }
  applyPose()
  const setState = (next: SkeletonAnimationState) => {
    state = next
    applyPose()
  }
  if (state === null) return Object.freeze({ group, animate: null, setState })
  return Object.freeze({
    group,
    animate: (deltaMilliseconds: number) => {
      if (state === null) return
      state = advanceSkeletonAnimation(state, animation, deltaMilliseconds)
      applyPose()
    },
    setState,
  })
}
