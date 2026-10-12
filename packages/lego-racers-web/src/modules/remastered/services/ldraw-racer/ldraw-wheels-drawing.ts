import type { SceneMesh } from '@lego-games/lego-racers/scene'
import type { Group } from 'three'
import { Group as ThreeGroup, Matrix4, Vector3 } from 'three'
import type { RacerPartDrawingRequest } from './ldraw-racer-drawing.types.ts'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { applyPlasticLook } from '../ldraw-car/ldraw-plastic.ts'
import { disposeObject } from './dispose-object.ts'
import { getBatchSurfaces } from './model-surface.ts'
import { createPoseControls, createSkeletonPoseSampler } from './skeleton-pose.ts'
import { getWheelSet } from './ldraw-wheel-sets.ts'
import { ensureStudioLights } from './studio-scene-lights.ts'
import { findWheels } from './wheel-analysis.ts'
import { getHubColor, getWheelKind } from './wheel-kind.ts'
import type { WheelShape } from './wheel-analysis.types.ts'
import type { LDrawRacerPartDrawing } from './ldraw-racer-drawing.types.ts'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'

const LDRAW_UNITS_PER_STUD = 20
const RAW_UNITS_PER_STUD = 64
const LDRAW_UNITS_PER_RAW_UNIT = LDRAW_UNITS_PER_STUD / RAW_UNITS_PER_STUD
const TYRE_COLOR_CODE = 0
const DEFAULT_RIM_COLOR_CODE = 72
const DIRECT_COLOR_PREFIX = '0x2'
const MAXIMUM_COPY_COUNT = 4
const IDENTITY_ROTATION = '1 0 0 0 1 0 0 0 1'

const getPartLine = (colorCode: number | string, part: string): string =>
  `1 ${String(colorCode)} 0 0 0 ${IDENTITY_ROTATION} ${part}.dat`

// The rim is drawn in the colour the original paints its wheel's hub: the picture's most common bright colour under the hub's faces.
const getRimColorCode = (
  request: RacerPartDrawingRequest,
  mesh: SceneMesh,
  wheel: WheelShape
): number | string => {
  const [surface] = getBatchSurfaces(request.model)
  const color =
    surface?.bitmap === null || surface === undefined
      ? null
      : getHubColor(mesh, surface.bitmap, wheel)
  return color === null
    ? DEFAULT_RIM_COLOR_CODE
    : `${DIRECT_COLOR_PREFIX}${color.toString(16).padStart(6, '0').toUpperCase()}`
}

// The wheel's frame in its bone's: the LDraw axle (z) along the wheel's axis, the other two axes the next ones in turn (a rotation),
// the rim's face outward.
const getAxisRotation = (axisIndex: number, isOutwardPositive: boolean): Matrix4 => {
  const axes = [new Vector3(), new Vector3(), new Vector3()]
  const next = (axisIndex + 1) % 3
  const afterNext = (axisIndex + 2) % 3
  const sign = isOutwardPositive ? 1 : -1
  axes[0]?.setComponent(next, sign)
  axes[1]?.setComponent(afterNext, 1)
  axes[2]?.setComponent(axisIndex, sign)
  const [x = new Vector3(), y = new Vector3(), z = new Vector3()] = axes
  return new Matrix4().makeBasis(x, y, z)
}

// Which side of its bone's other wheels each wheel is on, along its axis: the wheel's outside.
const getIsOutwardPositive = (wheel: WheelShape, wheels: readonly WheelShape[]): boolean => {
  const mates = wheels.filter(
    (other) => other.boneIndex === wheel.boneIndex && other.axisIndex === wheel.axisIndex
  )
  const mean =
    mates.reduce((sum, other) => sum + (other.centre[wheel.axisIndex] ?? 0), 0) / mates.length
  return (wheel.centre[wheel.axisIndex] ?? 0) >= mean
}

// The wheels of a chassis as LDraw tyres and rims: one pair for each wheel the original's model has, of the library's size nearest
// to it (then scaled to its exact size), on the bone that moves the original's wheel, so the animation turns and steers them.
export const createLDrawWheelsDrawing = (
  request: RacerPartDrawingRequest
): LDrawRacerPartDrawing | null => {
  const sampler = createSkeletonPoseSampler(request.model)
  const mesh =
    request.model.scene.meshes[request.model.scene.instances[0]?.levels[0]?.meshIndex ?? -1]
  if (sampler === null || mesh === undefined) return null
  const wheels = findWheels(mesh)
  const [firstWheel] = wheels
  if (firstWheel === undefined) return null
  const object = new ThreeGroup()
  const kind = getWheelKind(getBatchSurfaces(request.model)[0]?.materialName ?? '')
  const hubColorCode = getRimColorCode(request, mesh, firstWheel)
  const placements = wheels.map((wheel) => {
    const holder = new ThreeGroup()
    holder.matrixAutoUpdate = false
    object.add(holder)
    const set = getWheelSet(kind, wheel.radius * 2 * LDRAW_UNITS_PER_RAW_UNIT)
    const scale = (wheel.radius * 2) / set.diameter
    const copyCount = Math.min(
      Math.max(Math.round(wheel.width / (set.width * scale)), 1),
      MAXIMUM_COPY_COUNT
    )
    const local = new Matrix4()
      .makeTranslation(wheel.centre[0] ?? 0, wheel.centre[1] ?? 0, wheel.centre[2] ?? 0)
      .multiply(getAxisRotation(wheel.axisIndex, getIsOutwardPositive(wheel, wheels)))
      .multiply(new Matrix4().makeScale(scale, scale, scale))
    return { wheel, holder, set, local, copyCount }
  })
  const loadedGroups: Group[] = []
  let isDisposed = false
  const loads = [...new Set(placements.map((placement) => placement.set))].map((set) => {
    const text = [
      ...(set.tyrePart === null ? [] : [getPartLine(TYRE_COLOR_CODE, set.tyrePart)]),
      getPartLine(set.rimColorCode ?? hubColorCode, set.rimPart),
    ].join('\n')
    return parseLDrawModel(text).then(
      (model) => {
        if (isDisposed) return
        applyPlasticLook(model)
        loadedGroups.push(model)
        for (const placement of placements.filter((candidate) => candidate.set === set)) {
          // A drum as wide as several tyres (two wheels fused in the original's model) is several tyres side by side.
          for (let copy = 0; copy < placement.copyCount; copy += 1) {
            const clone = model.clone()
            clone.position.z = (copy - (placement.copyCount - 1) / 2) * set.width
            placement.holder.add(clone)
          }
        }
      },
      (error: unknown) => console.error('The LDraw library could not build the wheels', error)
    )
  })
  const pose = (state: SkeletonAnimationState | null) => {
    const matrices = state === null ? sampler.restMatrices : sampler.getMatrices(state)
    for (const { wheel, holder, local } of placements) {
      const bone = matrices[wheel.boneIndex]
      if (bone === undefined) continue
      holder.matrix.copy(bone).multiply(local)
      holder.matrixWorldNeedsUpdate = true
    }
    ensureStudioLights(object)
  }
  const controls = createPoseControls(sampler, pose)
  return Object.freeze({
    settled: Promise.all(loads).then(() => undefined),
    object,
    ...controls,
    dispose: () => {
      isDisposed = true
      for (const group of loadedGroups) disposeObject(group)
    },
  })
}
