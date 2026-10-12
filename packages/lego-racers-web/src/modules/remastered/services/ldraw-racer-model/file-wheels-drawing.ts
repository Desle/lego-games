import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Group, Matrix4, Vector3 } from 'three'
import { LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import { disposeObject } from '../ldraw-racer/dispose-object.ts'
import { createSkeletonPoseSampler } from '../ldraw-racer/skeleton-pose.ts'
import { findWheels } from '../ldraw-racer/wheel-analysis.ts'
import type { RacerPartDrawingRequest } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import type { FoundWheel } from './ldraw-racer-model.types.ts'

// The wheels a model brings (a tyre and rim of its own), posed by the bones of the original's wheels: each wheel of the model follows
// the bone of the original's wheel nearest to it, so the animation spins and steers it where the original's wheel is. The object is
// in the original model's frame before the model's scale, like the library wheels.
export const createFileWheelsDrawing = (
  found: readonly FoundWheel[],
  request: RacerPartDrawingRequest
) => {
  const sampler = createSkeletonPoseSampler(request.model)
  const mesh =
    request.model.scene.meshes[request.model.scene.instances[0]?.levels[0]?.meshIndex ?? -1]
  const shapes = mesh === undefined ? [] : findWheels(mesh)
  const scale = request.model.meshScales[0] ?? 1
  const studsToRaw = new Matrix4().makeScale(1 / scale, 1 / scale, 1 / scale)
  const object = new Group()
  const placements = found.map(({ unit, centre }) => {
    const holder = new Group()
    holder.matrixAutoUpdate = false
    const inner = new Group()
    inner.matrixAutoUpdate = false
    inner.matrix.copy(studsToRaw).multiply(LDRAW_TO_STUDS)
    inner.add(unit)
    holder.add(inner)
    object.add(holder)
    const raw = centre
      .clone()
      .applyMatrix4(LDRAW_TO_STUDS)
      .multiplyScalar(1 / scale)
    const nearest = shapes
      .map((shape) => {
        const bone = sampler?.restMatrices[shape.boneIndex]
        const place = new Vector3(...(shape.centre as [number, number, number]))
        return {
          shape,
          distance: bone === undefined ? Infinity : place.applyMatrix4(bone).distanceTo(raw),
        }
      })
      .sort((first, second) => first.distance - second.distance)[0]
    return { holder, boneIndex: nearest?.shape.boneIndex ?? null }
  })
  const setAnimationState = (state: SkeletonAnimationState) => {
    if (sampler === null) return
    const posed = sampler.getMatrices(state)
    for (const { holder, boneIndex } of placements) {
      const rest = boneIndex === null ? undefined : sampler.restMatrices[boneIndex]
      const pose = boneIndex === null ? undefined : posed[boneIndex]
      if (rest === undefined || pose === undefined) continue
      holder.matrix.copy(pose).multiply(rest.clone().invert())
      holder.matrixWorldNeedsUpdate = true
    }
  }
  return {
    object,
    setAnimationState,
    dispose: () => {
      for (const { unit } of found) disposeObject(unit)
    },
  }
}
