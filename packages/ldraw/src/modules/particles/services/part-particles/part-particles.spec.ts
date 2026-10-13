import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  LineSegments,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
} from 'three'
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three'
import {
  createParticleMaterial,
  createParticleMeshes,
  PARTICLE_OPACITY_ATTRIBUTE,
  writeParticles,
} from './part-particles.ts'

const createPart = (): Group => {
  const part = new Group()
  const body = new Mesh(new BoxGeometry(20, 8, 20), new MeshPhysicalMaterial())
  body.position.set(0, 4, 0)
  const edges = new LineSegments(new BufferGeometry())
  edges.geometry.setAttribute('position', new BufferAttribute(new Float32Array(6), 3))
  part.add(body, edges)
  return part
}

const getShader = (): WebGLProgramParametersWithUniforms =>
  ({
    uniforms: {},
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main() {\n#include <opaque_fragment>\n}',
  }) as unknown as WebGLProgramParametersWithUniforms

describe('createParticleMeshes', () => {
  it('makes one instanced mesh per mesh of the part and leaves its edge lines out', () => {
    // Arrange
    const part = createPart()

    // Act
    const meshes = createParticleMeshes(part, 64)

    // Assert
    expect(
      meshes.map((mesh) => [mesh.count, mesh.visible, mesh.instanceMatrix.count, mesh.castShadow])
    ).toEqual([[0, false, 64, false]])
  })

  it("puts the geometry in the part's frame without touching the prepared one", () => {
    // Arrange
    const part = createPart()
    const source = (part.children[0] as Mesh).geometry

    // Act
    const [mesh] = createParticleMeshes(part, 4)
    mesh?.geometry.computeBoundingBox()
    source.computeBoundingBox()

    // Assert
    expect([mesh?.geometry.boundingBox?.min.y, source.boundingBox?.min.y]).toEqual([0, -4])
  })
})

describe('writeParticles', () => {
  it('draws as many instances as particles were written, each with its matrix and opacity', () => {
    // Arrange
    const meshes = createParticleMeshes(createPart(), 8)
    const matrix = new Matrix4()

    // Act
    writeParticles(meshes, 2, (index, slot) => {
      slot.setMatrix(matrix.makeTranslation(index * 10, 0, 0))
      if (index === 1) slot.setOpacity(0.25)
    })
    const [mesh] = meshes
    const placed = new Matrix4()
    mesh?.getMatrixAt(1, placed)

    // Assert
    expect([
      mesh?.count,
      mesh?.visible,
      placed.elements[12],
      mesh?.geometry.getAttribute(PARTICLE_OPACITY_ATTRIBUTE).getX(0),
      mesh?.geometry.getAttribute(PARTICLE_OPACITY_ATTRIBUTE).getX(1),
    ]).toEqual([2, true, 10, 1, 0.25])
  })

  it('hides the meshes when a frame has no particles', () => {
    // Arrange
    const meshes = createParticleMeshes(createPart(), 8)
    writeParticles(meshes, 3, () => undefined)

    // Act
    writeParticles(meshes, 0, () => undefined)

    // Assert
    expect(meshes.map((mesh) => [mesh.count, mesh.visible])).toEqual([[0, false]])
  })
})

describe('createParticleMaterial', () => {
  it("fades the plastic per instance after the look's own shader, as a program of its own", () => {
    // Arrange
    const source = new MeshPhysicalMaterial()
    Object.assign(source, {
      onBeforeCompile: (shader: WebGLProgramParametersWithUniforms) =>
        Object.assign(shader, { fragmentShader: `// look\n${shader.fragmentShader}` }),
      customProgramCacheKey: () => 'ldraw-look',
    })
    const shader = getShader()

    // Act
    const material = createParticleMaterial(source)
    material.onBeforeCompile(shader, {} as WebGLRenderer)

    // Assert
    expect([
      material.transparent,
      material.customProgramCacheKey(),
      shader.fragmentShader.startsWith('// look'),
      shader.fragmentShader.includes('diffuseColor.a *= vParticleOpacity;'),
      shader.vertexShader.includes(`vParticleOpacity = ${PARTICLE_OPACITY_ATTRIBUTE};`),
    ]).toEqual([true, 'ldraw-look|part-particles', true, true, true])
  })
})
