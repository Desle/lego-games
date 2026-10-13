import type { Object3D } from 'three'
import { CoverageOrigin, HookKind, RacerPartKind } from './hd-coverage.types.ts'
import type { Census, CensusSighting, HookCall, InstanceSource } from './hd-coverage.types.ts'
import { getRacerPartIdentity } from './racer-part-classification.ts'
import { PARTICLE_MATERIAL_NAME_KEY } from '../../../../shared/viewer-extensions/viewer-extensions.ts'

const getInstanceSource = (object: Object3D): InstanceSource | null => {
  const meshPath: unknown = object.userData['meshPath']
  const worldPath: unknown = object.userData['worldPath']
  if (typeof meshPath !== 'string' || typeof worldPath !== 'string') return null
  return { instanceName: object.name, meshPath, worldPath }
}

// A visible mesh with something to draw anywhere below the object.
const getIsDrawingSomething = (object: Object3D): boolean => {
  if (!object.visible) return false
  if ('isMesh' in object && object.isMesh === true) return true
  return object.children.some(getIsDrawingSomething)
}

const LAYER_KINDS: Readonly<Record<HookKind, RacerPartKind>> = Object.freeze({
  [HookKind.CAR]: RacerPartKind.BODY,
  [HookKind.DRIVER]: RacerPartKind.DRIVER,
  [HookKind.PARTICLE]: RacerPartKind.PARTICLE,
})

const getLayerSighting = (call: HookCall): CensusSighting => ({
  origin: CoverageOrigin.LAYER,
  kind: LAYER_KINDS[call.hook],
  key: call.key,
  callId: call.id,
})

// The mesh that draws the original's particle quads of a material, by the material.
const getParticleMaterialName = (object: Object3D): string | null => {
  const name: unknown = object.userData[PARTICLE_MATERIAL_NAME_KEY]
  return typeof name === 'string' ? name : null
}

// Every racer part and particle material a scene would draw now: the drawings the layer returned (by their call), the original's
// racer meshes (by the file they were read from) and particle quads (by their material), and what else of the original's it draws.
// Hidden objects and everything below them are
// skipped, as the renderer skips them.
export const takeCensus = (
  scene: Object3D,
  calls: readonly HookCall[],
  getCallId: (object: Object3D) => number | null,
  championCarCodes: readonly string[]
): Census => {
  const sightings: CensusSighting[] = []
  const otherSources = new Set<string>()
  const visit = (object: Object3D) => {
    if (!object.visible) return
    const callId = getCallId(object)
    const call = callId === null ? undefined : calls.find((candidate) => candidate.id === callId)
    if (call !== undefined) {
      if (getIsDrawingSomething(object)) sightings.push(getLayerSighting(call))
      return
    }
    const particleMaterialName = getParticleMaterialName(object)
    if (particleMaterialName !== null) {
      if (getIsDrawingSomething(object))
        sightings.push({
          origin: CoverageOrigin.ORIGINAL,
          kind: RacerPartKind.PARTICLE,
          key: particleMaterialName,
          callId: null,
        })
      return
    }
    const source = getInstanceSource(object)
    const identity = source === null ? null : getRacerPartIdentity(source, championCarCodes)
    if (identity !== null) {
      if (getIsDrawingSomething(object))
        sightings.push({ origin: CoverageOrigin.ORIGINAL, ...identity, callId: null })
      return
    }
    if (source !== null && getIsDrawingSomething(object))
      otherSources.add(`${source.worldPath}|${source.meshPath}|${source.instanceName}`)
    object.children.forEach(visit)
  }
  visit(scene)
  return { sightings, otherSources: [...otherSources] }
}
