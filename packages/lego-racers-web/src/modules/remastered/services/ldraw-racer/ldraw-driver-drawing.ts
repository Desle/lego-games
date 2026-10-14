import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadBuiltDriverScene } from '@lego-games/lego-racers/racer-appearance'
import { Group, Matrix4 } from 'three'
import type { BuilderPart } from '@lego-games/ldraw/building'
import type { LDrawRacerPartDrawing, RacerPartDrawingRequest } from './ldraw-racer-drawing.types.ts'
import {
  createMaterialSet,
  disposeObject,
  holdPreparedModel,
  instantiateModel,
} from '@lego-games/ldraw/geometry'
import type { MaterialSet } from '@lego-games/ldraw/geometry'
import { LDrawDetail } from '@lego-games/ldraw/library'
import { loadLDrawModelText } from '../ldraw-models/ldraw-model-client.ts'
import { restoreDisplayColors } from './skin-colors.ts'
import { createFaceDecal, createTorsoDecal } from './minifig-decals.ts'
import type { MinifigDecal, PlacedDecal } from './minifig-decals.types.ts'
import { MinifigRole, poseMinifig } from '@lego-games/ldraw/minifig'
import { getMinifigPose } from './minifig-joints.ts'
import { getMinifigRig } from './minifig-rig.ts'
import { MinifigPosture } from './minifig-rig.types.ts'
import type { MinifigRig } from './minifig-rig.types.ts'
import { getIsPlainHead, getIsPlainTorso, parseDriverFile } from './driver-file.ts'
import type { DriverFilePart } from './driver-file.types.ts'
import { findDriverSource } from './driver-records.ts'
import { readMinifigPictures } from './minifig-pictures.ts'
import type { MinifigPictures } from './minifig-pictures.types.ts'
import { createPoseControls, createSkeletonPoseSampler } from './skeleton-pose.ts'
import type { SkeletonPoseSampler } from './skeleton-pose.types.ts'
import { ensureStudioLights } from './studio-scene-lights.ts'

const RAW_UNITS_PER_LDRAW_UNIT = 3.2
// The race's drivers and the menus' figures are models at 1/64 (raw units in 64ths of a stud); a cinema's figure may have another
// scale (1, 0.01), its bones and points in units of their own: the figure is as big as theirs once the model's scale is applied.
const FIGURE_MODEL_SCALE = 1 / 64
const IDENTITY_ROTATION = '1 0 0 0 1 0 0 0 1'
// A helmet that is a whole hat takes the face out of the figure builder's model; the model with no hat has the face and the torso.
const NO_HAT = 0
const HAND_ROLES: ReadonlySet<MinifigRole> = new Set([
  MinifigRole.LEFT_HAND,
  MinifigRole.RIGHT_HAND,
])

// How many of the model's raw units make one of the menus' figure's: 1 for a model at 1/64.
const getFigureUnit = (model: ModelScene): number => {
  const scale = model.meshScales[0] ?? FIGURE_MODEL_SCALE
  return scale === FIGURE_MODEL_SCALE || scale <= 0 ? 1 : FIGURE_MODEL_SCALE / scale
}

// The figure's frame in the model's: LDraw's (x to the viewer's right, y down, front toward -z) into the model's (x forward, y to the
// figure's left, z up), at the scale of the car's bricks, with the figure's hips at the height the skeleton's bind pose puts them.
const getFigureFrame = (rig: MinifigRig, unit: number): Matrix4 => {
  const rawUnits = RAW_UNITS_PER_LDRAW_UNIT * unit
  return new Matrix4().set(
    0,
    0,
    -rawUnits,
    0,
    rawUnits,
    0,
    0,
    0,
    0,
    -rawUnits,
    0,
    rig.hipsHeight * unit,
    0,
    0,
    0,
    1
  )
}

const LEG_ROLES: ReadonlySet<MinifigRole> = new Set([
  MinifigRole.HIPS,
  MinifigRole.LEFT_LEG,
  MinifigRole.RIGHT_LEG,
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

const getPartText = (part: BuilderPart): string =>
  `1 ${String(part.colorCode)} 0 0 0 ${IDENTITY_ROTATION} ${part.partName}`

// A part line's placement (rotation rows and offset) as a matrix of the figure's frame.
const getPartMatrix = (part: BuilderPart): Matrix4 => {
  const rows = [0, 1, 2].flatMap((row) => [
    ...part.rotation.slice(row * AXIS_COUNT, row * AXIS_COUNT + AXIS_COUNT),
    part.position[row] ?? 0,
  ])
  // The rows of an LDraw placement, read as three.js reads its own (columns first).
  return new Matrix4().fromArray([...rows, 0, 0, 0, 1]).transpose()
}

// Flesh the menus' lighting must show as the yellow it is: the head, and a hand in the head's colour.
const getIsSkin = (entry: DriverFilePart, headColorCode: number | null): boolean =>
  entry.role === MinifigRole.HEAD ||
  (HAND_ROLES.has(entry.role) && entry.part.colorCode === headColorCode)

// The game's picture on a head or torso of the file that has no print of its own; a printed part of the library keeps its print.
const getDecals = (
  parts: readonly DriverFilePart[],
  getPictures: () => MinifigPictures,
  search: string
): readonly PlacedDecal[] =>
  parts.flatMap((entry) => {
    const decal =
      entry.role === MinifigRole.HEAD && getIsPlainHead(entry.part.partName)
        ? getPictures().face
        : entry.role === MinifigRole.TORSO && getIsPlainTorso(entry.part.partName)
          ? getPictures().torso
          : null
    if (decal === null) return []
    const created =
      entry.role === MinifigRole.HEAD
        ? createFaceDecal(decal, search)
        : createTorsoDecal(decal, search)
    return created === null ? [] : [{ decal: created, entry }]
  })

const getRestOrPose = (sampler: SkeletonPoseSampler, state: SkeletonAnimationState | null) =>
  state === null ? sampler.restMatrices : sampler.getMatrices(state)

const getPicturesOnce = (archive: JamArchive, partBytes: readonly number[]) => {
  let pictures: MinifigPictures | null = null
  return () => {
    pictures ??= readMinifigPictures(loadBuiltDriverScene(archive, [NO_HAT, ...partBytes.slice(1)]))
    return pictures
  }
}

// A driver as the minifigure of his file in the models folder (`drivers/<NAME>.ldr`), or with no file the library parts of his catalogue
// pieces: each part, in its LDraw colour, put on the bone its role names of the skeleton the original poses its own figure with (the
// race driver's seated one or the menus' standing one), so its animations play on them; a head or torso with no print shows the
// original's picture. Null when a piece of a driver with no file has no mapping.
export const createLDrawDriverDrawing = (
  request: RacerPartDrawingRequest,
  search: string
): LDrawRacerPartDrawing | null => {
  const sampler = createSkeletonPoseSampler(request.model)
  const rig = sampler === null ? null : getMinifigRig(sampler.boneNames, sampler.parentIndices)
  const source = findDriverSource(
    request.archive,
    request.modelName,
    request.partBytes,
    request.model
  )
  if (sampler === null || rig === null || source === null) return null
  const unit = getFigureUnit(request.model)
  // The bind pose stands the figure on its pelvis bone: at the model's origin for the race's and the menus' figures, where the
  // cinema's action puts it for a cinema's.
  const figureFrame = (sampler.restMatrices[rig.pelvisIndex]?.clone() ?? new Matrix4()).multiply(
    getFigureFrame(rig, unit)
  )
  const object = new Group()
  // A standing figure always has its legs (an award's figure carries only a flat lid on the bone the waist hangs from).
  const isLegsDrawn =
    rig.posture === MinifigPosture.STANDING || getIsBoneDrawn(request.model, rig.pelvisIndex)
  const holders = new Map<MinifigRole, Group>(
    Object.values(MinifigRole).map((role) => {
      const holder = new Group()
      holder.matrixAutoUpdate = false
      holder.visible = isLegsDrawn || !LEG_ROLES.has(role)
      object.add(holder)
      return [role, holder]
    })
  )
  const materials = createMaterialSet()
  const skinMaterials: MaterialSet[] = []
  const decalMeshes: MinifigDecal['mesh'][] = []
  const live = { isDisposed: false }
  const getPictures = getPicturesOnce(request.archive, request.partBytes ?? source.partBytes)
  const addPart = (entry: DriverFilePart, isSkin: boolean) =>
    holdPreparedModel(getPartText(entry.part), LDrawDetail.HIGH).prepared.then(
      ({ model: prepared }) => {
        if (live.isDisposed) return
        const placed = new Group()
        placed.matrixAutoUpdate = false
        placed.matrix.copy(getPartMatrix(entry.part))
        // A flesh part has its colours changed once on its own copies of the materials, which no other part shares.
        const partMaterials = isSkin ? createMaterialSet() : materials
        if (isSkin) skinMaterials.push(partMaterials)
        const model = instantiateModel(prepared, partMaterials)
        if (isSkin) restoreDisplayColors(model)
        placed.add(model)
        holders.get(entry.role)?.add(placed)
      },
      (error: unknown) =>
        console.error(`The LDraw library has no part ${entry.part.partName}`, error)
    )
  const build = async () => {
    const text = source.kind === 'file' ? await loadLDrawModelText(source.file) : null
    if (live.isDisposed || (source.kind === 'file' && text === null)) return
    const parts = source.kind === 'file' ? parseDriverFile(text ?? '') : source.parts
    const headColorCode =
      parts.find((entry) => entry.role === MinifigRole.HEAD)?.part.colorCode ?? null
    const decals = getDecals(parts, getPictures, search)
    for (const { decal, entry } of decals) {
      decal.mesh.matrixAutoUpdate = false
      decal.mesh.matrix.copy(getPartMatrix(entry.part))
      decalMeshes.push(decal.mesh)
      holders.get(entry.role)?.add(decal.mesh)
    }
    await Promise.all([
      ...parts.map((entry) => addPart(entry, getIsSkin(entry, headColorCode))),
      ...decals.map(({ decal }) => decal.settled),
    ])
  }
  const pose = (state: SkeletonAnimationState | null) => {
    const posed = getRestOrPose(sampler, state)
    const matrices = poseMinifig(getMinifigPose(rig, sampler.restMatrices, posed, figureFrame))
    for (const [role, holder] of holders) {
      holder.matrix.copy(matrices[role])
      holder.matrixWorldNeedsUpdate = true
    }
    ensureStudioLights(object, rig.posture === MinifigPosture.STANDING)
  }
  const controls = createPoseControls(sampler, pose)
  return Object.freeze({
    settled: build().catch((error: unknown) =>
      console.error('The LDraw driver could not be drawn', error)
    ),
    object,
    ...controls,
    dispose: () => {
      live.isDisposed = true
      materials.dispose()
      for (const skin of skinMaterials) skin.dispose()
      for (const mesh of decalMeshes) disposeObject(mesh)
    },
  })
}
