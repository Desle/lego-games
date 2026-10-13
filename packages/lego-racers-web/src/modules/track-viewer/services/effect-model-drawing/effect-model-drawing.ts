import type { ModelScene } from '@lego-games/lego-racers/scene'
import {
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Group, Matrix4 } from 'three'
import { getEffectModelDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { EffectModelDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { showDrawingInPlaceOfModel } from '../built-car-drawing/built-car-drawing.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'

const MATRIX_SIZE = 16

// The name a layer knows an effect's model by: the stem of its mesh file (`DMISSILE.GDB` is DMISSILE).
export const getEffectModelName = (model: ModelScene): string =>
  (model.scene.meshes[0]?.path.split('\\').at(-1) ?? '').replace(/\.[^.]*$/, '').toUpperCase()

// The matrix that takes the drawing (fitted to the mesh's vertices as the file stores them) to where the pose puts the mesh, in
// the model's frame with its scale applied: the bone the mesh's first vertex hangs on (GolDP.dll 0x10014c20 builds the bone
// matrices, 0x10023b10 moves each vertex by its bone's), scaled like the mesh. Null for a model without a skeleton.
const createBonePoser = (
  model: ModelScene
): ((state: SkeletonAnimationState) => Matrix4) | null => {
  const level = model.scene.instances[0]?.levels[0]
  const skeleton = model.scene.skeletons[level?.skeletonIndex ?? -1]?.skeleton
  const animation = model.scene.animations[level?.animationIndex ?? -1]?.animation
  const boneIndex =
    model.scene.meshes[level?.meshIndex ?? -1]?.drawBatches[0]?.transformIndices[0] ?? 0
  if (skeleton === undefined || animation === undefined) return null
  const restPose = getRestPose(skeleton)
  const scale = model.meshScales[0] ?? 1
  const toMesh = new Matrix4().makeScale(1 / scale, 1 / scale, 1 / scale)
  return (state) => {
    const matrices = getBoneMatrices(skeleton, getSkeletonPose(restPose, animation, state))
    return new Matrix4()
      .makeScale(scale, scale, scale)
      .multiply(new Matrix4().fromArray(matrices, boneIndex * MATRIX_SIZE))
      .multiply(toMesh)
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
  const getPoseMatrix = createBonePoser(request.model)
  if (getPoseMatrix === null) return shown
  return {
    group: shown.group,
    object: {
      ...shown.object,
      setAnimationState: (state) => {
        shown.object.setAnimationState(state)
        posed.matrix.copy(getPoseMatrix(state))
        posed.matrixWorldNeedsUpdate = true
      },
    },
  }
}
