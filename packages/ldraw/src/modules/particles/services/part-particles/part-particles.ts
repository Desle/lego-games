import { Group, InstancedBufferAttribute, InstancedMesh } from 'three'
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

const addParticleOpacity = (
  shader: WebGLProgramParametersWithUniforms
): WebGLProgramParametersWithUniforms =>
  Object.assign(shader, {
    vertexShader: shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nattribute float ${PARTICLE_OPACITY_ATTRIBUTE};\nvarying float ${PARTICLE_OPACITY_VARYING};`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${PARTICLE_OPACITY_VARYING} = ${PARTICLE_OPACITY_ATTRIBUTE};`
      ),
    fragmentShader: shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float ${PARTICLE_OPACITY_VARYING};`)
      .replace(
        '#include <opaque_fragment>',
        `diffuseColor.a *= ${PARTICLE_OPACITY_VARYING};\n#include <opaque_fragment>`
      ),
  })

// A copy of the part's plastic, after its look and lighting, that fades each particle by its own opacity.
export const createParticleMaterial = (source: Material): Material => {
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
      addParticleOpacity(shader)
    },
    customProgramCacheKey: () => `${previousCacheKey()}|part-particles`,
  })
  return copy
}

const getParticleMaterials = (material: Material | Material[]): Material | Material[] =>
  Array.isArray(material)
    ? material.filter(getIsMaterial).map(createParticleMaterial)
    : createParticleMaterial(material)

// The part's meshes (its edge lines are left out: at a particle's size they would be a draw call each for a few pixels), each as
// one instanced mesh of its own geometry in the part's frame, with an opacity for each instance.
export const createParticleMeshes = (model: Group, maxCount: number): readonly InstancedMesh[] => {
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
    const mesh = new InstancedMesh(geometry, getParticleMaterials(child.material), maxCount)
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

const getPartLine = ({ partName, colorCode }: PartParticlesSettings): string =>
  `1 ${String(colorCode)} 0 0 0 1 0 0 0 1 0 0 0 1 ${partName}.dat`

const disposeMeshes = (meshes: readonly InstancedMesh[]) => {
  for (const mesh of meshes) {
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) material.dispose()
    mesh.dispose()
  }
}

// One part of the library in one colour, made through the one prepare path (the active look's plastic, merged), drawn as particles:
// one instanced mesh per material of the part, so a thousand particles cost the draw calls of one part. The app writes every
// particle of a frame with `setParticles`; until the part is ready nothing is drawn.
export const createPartParticles = (settings: PartParticlesSettings): PartParticles => {
  const object = new Group()
  const hold = holdPreparedModel(getPartLine(settings), LDrawDetail.LOW, PreparedModelKind.PART)
  let meshes: readonly InstancedMesh[] = []
  let isDisposed = false
  const shown = hold.prepared.then(async ({ model }) => {
    if (isDisposed) return
    meshes = createParticleMeshes(model, settings.maxCount)
    object.add(...meshes)
    await precompileShaders(object)
  })
  return {
    object,
    shown,
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
