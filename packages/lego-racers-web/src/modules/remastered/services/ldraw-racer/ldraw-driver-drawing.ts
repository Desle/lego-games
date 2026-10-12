import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Group, Matrix4, Quaternion, Vector3 } from 'three'
import type { RacerPartDrawingRequest } from './ldraw-racer-drawing.types.ts'
import { applyPlasticLook } from '../ldraw-car/ldraw-plastic.ts'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { disposeObject } from './dispose-object.ts'
import type { LDrawRacerPartDrawing } from './ldraw-racer-drawing.types.ts'
import { createFaceDecal, createTorsoDecal } from './minifig-decals.ts'
import { createMinifigPartPlans } from './minifig-assembly.ts'
import { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'
import type { MinifigPartPlan } from './minifig-assembly.types.ts'
import { getMinifigRig } from './minifig-rig.ts'
import type { MinifigAttachment, MinifigRig } from './minifig-rig.types.ts'
import { createMinifigSpec, getDriverPartBytes } from './minifig-spec.ts'
import { createPoseControls, createSkeletonPoseSampler } from './skeleton-pose.ts'
import type { SkeletonPoseSampler } from './skeleton-pose.types.ts'
import { ensureStudioLights } from './studio-scene-lights.ts'

const RAW_UNITS_PER_LDRAW_UNIT = 3.2
const ARM_SPLAY = (9.78 * Math.PI) / 180
const IDENTITY_ROTATION = '1 0 0 0 1 0 0 0 1'
const HEAD_ORIGIN_Y = -48
const TORSO_ORIGIN_Y = -24

// The figure's frame in the model's: LDraw's (x to the viewer's right, y down, front toward -z) into the model's (x forward, y to the
// figure's left, z up), at the scale of the car's bricks, with the figure's hips at the height the skeleton's bind pose puts them.
const getFigureFrame = (rig: MinifigRig): Matrix4 =>
  new Matrix4().set(
    0,
    0,
    -RAW_UNITS_PER_LDRAW_UNIT,
    0,
    RAW_UNITS_PER_LDRAW_UNIT,
    0,
    0,
    0,
    0,
    -RAW_UNITS_PER_LDRAW_UNIT,
    0,
    rig.hipsHeight,
    0,
    0,
    0,
    1
  )

const getBonePosition = (matrices: readonly Matrix4[], boneIndex: number): Vector3 => {
  const matrix = matrices[boneIndex]
  return matrix === undefined ? new Vector3() : new Vector3().setFromMatrixPosition(matrix)
}

// What carries a part now, as a change of the bind pose: a bone's matrix with the bind pose's undone, or the turn that takes the chord
// between two bones from its bind direction to its present one, about the first bone's present place. An arm splays outward as it
// hangs, the more the lower it hangs, as the library's own arms do.
const getAttachmentMatrix = (
  attachment: MinifigAttachment,
  rest: readonly Matrix4[],
  pose: readonly Matrix4[]
): Matrix4 => {
  if (attachment.kind === 'bone') {
    const restMatrix = rest[attachment.boneIndex]
    const poseMatrix = pose[attachment.boneIndex]
    return restMatrix === undefined || poseMatrix === undefined
      ? new Matrix4()
      : poseMatrix.clone().multiply(restMatrix.clone().invert())
  }
  const { startIndex, endIndex, outwardSign } = attachment
  const restStart = getBonePosition(rest, startIndex)
  const poseStart = getBonePosition(pose, startIndex)
  const bindDirection = getBonePosition(rest, endIndex).sub(restStart).normalize()
  const direction = getBonePosition(pose, endIndex).sub(poseStart).normalize()
  const hangingShare = Math.max(0, -direction.z)
  direction.y += outwardSign * Math.tan(ARM_SPLAY) * hangingShare
  const turn = new Matrix4().makeRotationFromQuaternion(
    new Quaternion().setFromUnitVectors(bindDirection, direction.normalize())
  )
  return new Matrix4()
    .makeTranslation(poseStart.x, poseStart.y, poseStart.z)
    .multiply(turn)
    .multiply(new Matrix4().makeTranslation(-restStart.x, -restStart.y, -restStart.z))
}

const getPartText = (plan: MinifigPartPlan): string =>
  `1 ${String(plan.color)} 0 0 0 ${IDENTITY_ROTATION} ${plan.part}.dat`

const getRestOrPose = (sampler: SkeletonPoseSampler, state: SkeletonAnimationState | null) =>
  state === null ? sampler.restMatrices : sampler.getMatrices(state)

// A driver as a minifigure of the library's parts: the hat, head, torso, arms, hands, hips and legs the part bytes name (a champion's are in
// the driver database), put on the bones of the skeleton the original poses its own figure with (the race driver's seated one or the
// menus' standing one), so its animations play on them; the face and the front of the torso are the original's pictures.
export const createLDrawDriverDrawing = (
  request: RacerPartDrawingRequest,
  search: string
): LDrawRacerPartDrawing | null => {
  const sampler = createSkeletonPoseSampler(request.model)
  const rig = sampler === null ? null : getMinifigRig(sampler.boneNames)
  const partBytes =
    request.partBytes ??
    (request.modelName === null ? null : getDriverPartBytes(request.archive, request.modelName))
  if (sampler === null || rig === null || partBytes === null) return null
  const spec = createMinifigSpec(request.archive, partBytes)
  const plans = createMinifigPartPlans(spec, rig.posture)
  const figureFrame = getFigureFrame(rig)
  const object = new Group()
  const holders = new Map<MinifigPartKey, Group>(
    Object.values(MinifigPartKey).map((key) => {
      const holder = new Group()
      holder.matrixAutoUpdate = false
      object.add(holder)
      return [key, holder]
    })
  )
  const loadedGroups: Group[] = []
  let isDisposed = false
  const loads = plans.map((plan) =>
    parseLDrawModel(getPartText(plan)).then(
      (model) => {
        if (isDisposed) return
        applyPlasticLook(model)
        loadedGroups.push(model)
        const placed = new Group()
        placed.matrixAutoUpdate = false
        placed.matrix.copy(plan.matrix)
        placed.add(model)
        holders.get(plan.key)?.add(placed)
      },
      (error: unknown) => console.error(`The LDraw library has no part ${plan.part}`, error)
    )
  )
  const decals = [
    spec.surfaces.face === null
      ? null
      : {
          decal: createFaceDecal(spec.surfaces.face, search),
          key: MinifigPartKey.HEAD,
          y: HEAD_ORIGIN_Y,
        },
    spec.surfaces.torso === null
      ? null
      : {
          decal: createTorsoDecal(spec.surfaces.torso, search),
          key: MinifigPartKey.TORSO,
          y: TORSO_ORIGIN_Y,
        },
  ]
  for (const entry of decals) {
    if (entry?.decal == null) continue
    entry.decal.mesh.position.set(0, entry.y, 0)
    holders.get(entry.key)?.add(entry.decal.mesh)
  }
  const pose = (state: SkeletonAnimationState | null) => {
    const posed = getRestOrPose(sampler, state)
    for (const [key, holder] of holders) {
      holder.matrix
        .copy(getAttachmentMatrix(rig.attachments[key], sampler.restMatrices, posed))
        .multiply(figureFrame)
      holder.matrixWorldNeedsUpdate = true
    }
    ensureStudioLights(object, rig.posture === MinifigPosture.STANDING)
  }
  const controls = createPoseControls(sampler, pose)
  return Object.freeze({
    settled: Promise.all([...loads, ...decals.map((entry) => entry?.decal?.settled)]).then(
      () => undefined
    ),
    object,
    ...controls,
    dispose: () => {
      isDisposed = true
      for (const group of loadedGroups) disposeObject(group)
      for (const entry of decals) {
        if (entry?.decal == null) continue
        disposeObject(entry.decal.mesh)
      }
    },
  })
}
