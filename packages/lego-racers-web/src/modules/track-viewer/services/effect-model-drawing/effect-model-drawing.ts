import type { ModelScene } from '@lego-games/lego-racers/scene'
import {
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Group, Matrix4 } from 'three'
import type { Object3D } from 'three'
import { POSED_BONE_KEY } from '../../../../shared/viewer-extensions/effect-model-names.ts'
import { getEffectModelDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { EffectModelDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { showDrawingInPlaceOfModel } from '../built-car-drawing/built-car-drawing.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'

const MATRIX_SIZE = 16

// The name a layer knows an effect's model by: the stem of its mesh file (`DMISSILE.GDB` is DMISSILE).
export const getEffectModelName = (model: ModelScene): string =>
  (model.scene.meshes[0]?.path.split('\\').at(-1) ?? '').replace(/\.[^.]*$/, '').toUpperCase()

// The matrices that take a drawing (fitted to the mesh's vertices as the file stores them) to where the pose puts the mesh, in
// the model's frame with its scale applied: a bone's (GolDP.dll 0x10014c20 builds the bone matrices, 0x10023b10 moves each
// vertex by its bone's), scaled like the mesh. Null for a model without a skeleton.
const createBonePoser = (
  model: ModelScene
): ((state: SkeletonAnimationState) => (boneIndex: number) => Matrix4) | null => {
  const level = model.scene.instances[0]?.levels[0]
  const scale = model.meshScales[0] ?? 1
  const skeleton = model.scene.skeletons[level?.skeletonIndex ?? -1]?.skeleton
  const animation = model.scene.animations[level?.animationIndex ?? -1]?.animation
  if (skeleton === undefined || animation === undefined) return null
  const toMesh = new Matrix4().makeScale(1 / scale, 1 / scale, 1 / scale)
  const restPose = getRestPose(skeleton)
  return (state) => {
    const matrices = getBoneMatrices(skeleton, getSkeletonPose(restPose, animation, state))
    return (boneIndex) =>
      new Matrix4()
        .makeScale(scale, scale, scale)
        .multiply(new Matrix4().fromArray(matrices, boneIndex * MATRIX_SIZE))
        .multiply(toMesh)
  }
}

// The bone the mesh's first vertex hangs on: a drawing without posed parts follows it whole.
const getFirstVertexBone = (model: ModelScene): number => {
  const level = model.scene.instances[0]?.levels[0]
  return model.scene.meshes[level?.meshIndex ?? -1]?.drawBatches[0]?.transformIndices[0] ?? 0
}

const getPosedBone = (part: Object3D): number | null => {
  const bone: unknown = part.userData[POSED_BONE_KEY]
  return typeof bone === 'number' ? bone : null
}

// Poses the drawing: each of its parts that names a bone (POSED_BONE_KEY) by that bone, else the whole by the first vertex's.
const poseDrawing = (
  posed: Group,
  drawing: Object3D,
  getBoneMatrix: (boneIndex: number) => Matrix4,
  firstVertexBone: number
) => {
  const posedParts = drawing.children.filter((part) => getPosedBone(part) !== null)
  if (posedParts.length === 0) posed.matrix.copy(getBoneMatrix(firstVertexBone))
  else posed.matrix.identity()
  Object.assign(posed, { matrixWorldNeedsUpdate: true })
  for (const part of posedParts) {
    part.matrix.copy(getBoneMatrix(getPosedBone(part) ?? firstVertexBone))
    part.matrixWorldNeedsUpdate = true
  }
}

// An effect's model, in place of which a viewer extension may offer a drawing; the model itself otherwise. The drawing follows
// the pose the race gives the model (a brick's turn is its clip, 0x00457900), as the model's own vertices would.
export const showEffectModelDrawing = (
  modelObject: ModelObject,
  request: EffectModelDrawingRequest
): ModelObject => {
  const drawing = getEffectModelDrawing(request)
  if (drawing === null) return modelObject
  const posed = new Group()
  posed.matrixAutoUpdate = false
  posed.add(drawing)
  const shown = showDrawingInPlaceOfModel(modelObject, posed)
  const getPose = createBonePoser(request.model)
  if (getPose === null) return shown
  const firstVertexBone = getFirstVertexBone(request.model)
  return {
    group: shown.group,
    object: {
      ...shown.object,
      setAnimationState: (state) => {
        shown.object.setAnimationState(state)
        poseDrawing(posed, drawing, getPose(state), firstVertexBone)
      },
    },
  }
}
