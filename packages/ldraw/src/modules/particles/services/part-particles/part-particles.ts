import { Box3, Group, InstancedBufferAttribute, InstancedMesh } from 'three'
import type { BufferGeometry, Material, WebGLProgramParametersWithUniforms } from 'three'
import {
  getIsMaterial,
  getIsMesh,
  holdPreparedModel,
  PreparedModelKind,
} from '../../../geometry/index.ts'
import { LDrawDetail } from '../../../library/index.ts'
import { precompileShaders } from '../../../material/index.ts'
import type {
  PartParticles,
  PartParticleSlot,
  PartParticlesSettings,
  PartParticleWriter,
} from './part-particles.types.ts'

export const PARTICLE_OPACITY_ATTRIBUTE = 'particleOpacity'
const PARTICLE_OPACITY_VARYING = 'vParticleOpacity'
const PARTICLE_DEPTH_VARYING = 'vParticleDepth'
// A fragment fainter than this is dropped, so a faded piece writes no depth over what is behind it.
const DROPPED_OPACITY = 0.004

const getGlslNumber = (value: number): string =>
  Number.isInteger(value) ? `${String(value)}.0` : String(value)

// The near fade: nothing closer than half the distance, full opacity from the distance on (in the drawing's units).
const getNearFade = (nearFadeDistance: number): string =>
  nearFadeDistance > 0
    ? `diffuseColor.a *= smoothstep(${getGlslNumber(nearFadeDistance / 2)}, ${getGlslNumber(nearFadeDistance)}, ${PARTICLE_DEPTH_VARYING});\n`
    : ''

const addParticleOpacity = (
  shader: WebGLProgramParametersWithUniforms,
  nearFadeDistance: number
): WebGLProgramParametersWithUniforms =>
  Object.assign(shader, {
    vertexShader: shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nattribute float ${PARTICLE_OPACITY_ATTRIBUTE};\nvarying float ${PARTICLE_OPACITY_VARYING};\nvarying float ${PARTICLE_DEPTH_VARYING};`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${PARTICLE_OPACITY_VARYING} = ${PARTICLE_OPACITY_ATTRIBUTE};`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>\n${PARTICLE_DEPTH_VARYING} = -mvPosition.z;`
      ),
    fragmentShader: shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying float ${PARTICLE_OPACITY_VARYING};\nvarying float ${PARTICLE_DEPTH_VARYING};`
      )
      .replace(
        '#include <opaque_fragment>',
        `diffuseColor.a *= ${PARTICLE_OPACITY_VARYING};\n${getNearFade(nearFadeDistance)}if (diffuseColor.a < ${getGlslNumber(DROPPED_OPACITY)}) discard;\n#include <opaque_fragment>`
      ),
  })

// A copy of the part's plastic, after its look and lighting, that fades each particle by its own opacity and, closer to the camera
// than `nearFadeDistance` (0: never), by its distance, so a particle at the lens never fills the screen.
export const createParticleMaterial = (source: Material, nearFadeDistance = 0): Material => {
  const copy = source.clone()
  const previousOnBeforeCompile = source.onBeforeCompile.bind(source)
  const previousCacheKey = source.customProgramCacheKey.bind(source)
  Object.assign(copy, {
    transparent: true,
    onBeforeCompile: (
      shader: WebGLProgramParametersWithUniforms,
      renderer: Parameters<Material['onBeforeCompile']>[1]
    ) => {
      previousOnBeforeCompile(shader, renderer)
      addParticleOpacity(shader, nearFadeDistance)
    },
    customProgramCacheKey: () => `${previousCacheKey()}|part-particles|${String(nearFadeDistance)}`,
  })
  return copy
}

const getParticleMaterials = (
  material: Material | Material[],
  nearFadeDistance: number
): Material | Material[] =>
  Array.isArray(material)
    ? material.filter(getIsMaterial).map((each) => createParticleMaterial(each, nearFadeDistance))
    : createParticleMaterial(material, nearFadeDistance)

// The part's meshes (its edge lines are left out: at a particle's size they would be a draw call each for a few pixels), each as
// one instanced mesh of its own geometry in the part's frame, with an opacity for each instance.
export const createParticleMeshes = (
  model: Group,
  maxCount: number,
  nearFadeDistance = 0
): readonly InstancedMesh[] => {
  model.updateMatrixWorld(true)
  const inverseRoot = model.matrixWorld.clone().invert()
  const meshes: InstancedMesh[] = []
  model.traverse((child) => {
    if (!getIsMesh(child)) return
    const geometry: BufferGeometry = child.geometry.clone()
    geometry.applyMatrix4(inverseRoot.clone().multiply(child.matrixWorld))
    geometry.setAttribute(
      PARTICLE_OPACITY_ATTRIBUTE,
      new InstancedBufferAttribute(new Float32Array(maxCount), 1)
    )
    const mesh = new InstancedMesh(
      geometry,
      getParticleMaterials(child.material, nearFadeDistance),
      maxCount
    )
    mesh.count = 0
    mesh.visible = false
    mesh.frustumCulled = false
    mesh.castShadow = false
    mesh.receiveShadow = false
    meshes.push(mesh)
  })
  return meshes
}

export const writeParticles = (
  meshes: readonly InstancedMesh[],
  count: number,
  writeParticle: PartParticleWriter
) => {
  let index = 0
  const slot: PartParticleSlot = {
    setMatrix: (matrix) => {
      for (const mesh of meshes) mesh.setMatrixAt(index, matrix)
    },
    setOpacity: (opacity) => {
      for (const mesh of meshes)
        mesh.geometry.getAttribute(PARTICLE_OPACITY_ATTRIBUTE).setX(index, opacity)
    },
  }
  for (index = 0; index < count; index++) {
    slot.setOpacity(1)
    writeParticle(index, slot)
  }
  for (const mesh of meshes) {
    mesh.count = count
    mesh.visible = count > 0
    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.getAttribute(PARTICLE_OPACITY_ATTRIBUTE).needsUpdate = true
  }
}

// One part of the library in one colour at the origin, as the model text of a kind of particle.
export const getParticlePartText = (partName: string, colorCode: number): string =>
  `1 ${String(colorCode)} 0 0 0 1 0 0 0 1 0 0 0 1 ${partName}.dat`

const disposeMeshes = (meshes: readonly InstancedMesh[]) => {
  for (const mesh of meshes) {
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) material.dispose()
    mesh.dispose()
  }
}

// A model (one part, or a small model of a few) made through the one prepare path (the active look's plastic, merged), drawn as
// particles: one instanced mesh per material of the model, so a thousand particles cost the draw calls of one part. The app writes
// every particle of a frame with `setParticles`; until the model is ready nothing is drawn.
export const createPartParticles = (settings: PartParticlesSettings): PartParticles => {
  const object = new Group()
  const hold = holdPreparedModel(settings.modelText, LDrawDetail.LOW, PreparedModelKind.PART)
  let meshes: readonly InstancedMesh[] = []
  let modelBounds: Box3 | null = null
  let isDisposed = false
  const shown = hold.prepared.then(async ({ model }) => {
    if (isDisposed) return
    model.updateMatrixWorld(true)
    modelBounds = new Box3().setFromObject(model).applyMatrix4(model.matrixWorld.clone().invert())
    meshes = createParticleMeshes(model, settings.maxCount, settings.nearFadeDistance)
    object.add(...meshes)
    await precompileShaders(object)
  })
  return {
    object,
    shown,
    getModelBounds: () => modelBounds?.clone() ?? null,
    setParticles: (count, writeParticle) =>
      writeParticles(meshes, Math.min(Math.max(count, 0), settings.maxCount), writeParticle),
    dispose: () => {
      isDisposed = true
      object.removeFromParent()
      disposeMeshes(meshes)
      meshes = []
      hold.release()
    },
  }
}
