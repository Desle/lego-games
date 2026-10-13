import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Group, Matrix4 } from 'three'
import type { LDrawRacerPartDrawing, RacerPartDrawingRequest } from './ldraw-racer-drawing.types.ts'
import {
  createMaterialSet,
  disposeObject,
  holdPreparedModel,
  instantiateModel,
} from '@lego-games/ldraw/geometry'
import type { MaterialSet } from '@lego-games/ldraw/geometry'
import { LDrawDetail } from '@lego-games/ldraw/library'
import { restoreDisplayColors } from './skin-colors.ts'
import { createFaceDecal, createTorsoDecal } from './minifig-decals.ts'
import { createMinifigPartPlans } from './minifig-assembly.ts'
import { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'
import type { MinifigPartPlan } from './minifig-assembly.types.ts'
import { MINIFIG_GEOMETRY } from '@lego-games/ldraw/minifig'
import { getJointMatrices } from './minifig-joints.ts'
import { getMinifigRig } from './minifig-rig.ts'
import type { MinifigRig } from './minifig-rig.types.ts'
import { createMinifigSpec, getDriverPartBytes } from './minifig-spec.ts'
import { createPoseControls, createSkeletonPoseSampler } from './skeleton-pose.ts'
import type { SkeletonPoseSampler } from './skeleton-pose.types.ts'
import { ensureStudioLights } from './studio-scene-lights.ts'

const RAW_UNITS_PER_LDRAW_UNIT = 3.2
const IDENTITY_ROTATION = '1 0 0 0 1 0 0 0 1'

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

const LEG_PART_KEYS: ReadonlySet<MinifigPartKey> = new Set([
  MinifigPartKey.HIPS,
  MinifigPartKey.LEFT_LEG,
  MinifigPartKey.RIGHT_LEG,
])

// A bone whose drawn corners span less than this (raw units, up the model) carries only a lid, not a part of the figure.
const DRAWN_BONE_HEIGHT = 8
const AXIS_COUNT = 3

// Whether the original's figure draws a body part on a bone: a champion's race model has only a flat lid on its pelvis (his legs are
// left out, inside the car), the figure builder's and the menus' figures have legs there.
const getIsBoneDrawn = (model: ModelScene, boneIndex: number): boolean => {
  const mesh = model.scene.meshes[model.scene.instances[0]?.levels[0]?.meshIndex ?? -1]
  if (mesh === undefined) return true
  const heights = mesh.drawBatches.flatMap((batch) =>
    [...batch.vertexIndices].flatMap((vertex, corner) =>
      batch.transformIndices[corner] === boneIndex
        ? [mesh.positions[vertex * AXIS_COUNT + 2] ?? 0]
        : []
    )
  )
  return heights.length > 0 && Math.max(...heights) - Math.min(...heights) >= DRAWN_BONE_HEIGHT
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
  const plans = createMinifigPartPlans(spec)
  const figureFrame = getFigureFrame(rig)
  const object = new Group()
  const isLegsDrawn = getIsBoneDrawn(request.model, rig.pelvisIndex)
  const holders = new Map<MinifigPartKey, Group>(
    Object.values(MinifigPartKey).map((key) => {
      const holder = new Group()
      holder.matrixAutoUpdate = false
      holder.visible = isLegsDrawn || !LEG_PART_KEYS.has(key)
      object.add(holder)
      return [key, holder]
    })
  )
  const materials = createMaterialSet()
  const skinMaterials: MaterialSet[] = []
  const loads = plans.map((plan) =>
    holdPreparedModel(getPartText(plan), LDrawDetail.HIGH).prepared.then(
      ({ model: prepared }) => {
        const placed = new Group()
        placed.matrixAutoUpdate = false
        placed.matrix.copy(plan.matrix)
        // A flesh part has its colours changed once on its own copies of the materials, which no other part shares.
        const partMaterials = plan.isSkin ? createMaterialSet() : materials
        if (plan.isSkin) skinMaterials.push(partMaterials)
        const model = instantiateModel(prepared, partMaterials)
        if (plan.isSkin) restoreDisplayColors(model)
        placed.add(model)
        holders.get(plan.key)?.add(placed)
      },
      (error: unknown) => console.error(`The LDraw library has no part ${plan.part}`, error)
    )
  )
  const decals = [
    spec.face !== null || spec.surfaces.face === null
      ? null
      : {
          decal: createFaceDecal(spec.surfaces.face, search),
          key: MinifigPartKey.HEAD,
          origin: MINIFIG_GEOMETRY.head,
        },
    spec.torso !== null || spec.surfaces.torso === null
      ? null
      : {
          decal: createTorsoDecal(spec.surfaces.torso, search),
          key: MinifigPartKey.TORSO,
          origin: MINIFIG_GEOMETRY.torso,
        },
  ]
  for (const entry of decals) {
    if (entry?.decal == null) continue
    entry.decal.mesh.position.setFromMatrixPosition(entry.origin)
    holders.get(entry.key)?.add(entry.decal.mesh)
  }
  const pose = (state: SkeletonAnimationState | null) => {
    const posed = getRestOrPose(sampler, state)
    const jointMatrices = getJointMatrices(rig, sampler.restMatrices, posed, figureFrame)
    for (const [key, holder] of holders) {
      holder.matrix.copy(jointMatrices.get(key) ?? figureFrame)
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
      materials.dispose()
      for (const skin of skinMaterials) skin.dispose()
      for (const entry of decals) {
        if (entry?.decal == null) continue
        disposeObject(entry.decal.mesh)
      }
    },
  })
}
