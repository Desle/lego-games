import { Matrix4, Vector3 } from 'three'
import type { ParticleView } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getParticleOpacity, setParticleMatrix } from './ldraw-particle-drawing.ts'
import { LDRAW_PARTICLE_MATERIALS, LDRAW_PARTICLE_PARTS } from './ldraw-particle-mappings.ts'

// A quad facing a camera that looks along +y with z up: right is +x, down is -z.
const getView = (materialName: string, alpha: number): ParticleView => ({
  materialName,
  centre: { x: 10, y: 20, z: 30 },
  right: { x: 4, y: 0, z: 0 },
  down: { x: 0, y: 0, z: -2 },
  color: [200, 200, 200, alpha],
})

const round = (vector: Vector3): readonly number[] =>
  vector.toArray().map((value) => Math.round(value * 1000) / 1000 + 0)

describe('setParticleMatrix', () => {
  it("spans the quad with the part's 20 units and turns its studs to the camera", () => {
    // Arrange
    const view = getView('smoke1', 30)

    // Act
    const matrix = setParticleMatrix(new Matrix4(), view)
    const studSide = new Vector3(0, -1, 0).applyMatrix4(matrix).sub(new Vector3(10, 20, 30))

    // Assert
    expect([
      round(new Vector3(10, 0, 0).applyMatrix4(matrix)),
      round(new Vector3(0, 0, 10).applyMatrix4(matrix)),
      round(studSide.normalize()),
      matrix.determinant() > 0,
    ]).toEqual([[12, 20, 30], [10, 20, 31], [0, -1, 0], true])
  })
})

describe('getParticleOpacity', () => {
  it("fades with the original's rows: solid at the first row's alpha, fainter after", () => {
    // Arrange
    const rows = [30, 20, 15, 10]

    // Act
    const opacities = rows.map((alpha, index) =>
      getParticleOpacity(getView(`smoke${String(index + 1)}`, alpha))
    )

    // Assert
    expect(opacities.map((opacity) => Math.round(opacity * 100) / 100)).toEqual([
      1, 0.67, 0.5, 0.33,
    ])
  })
})

describe('the particle mappings', () => {
  it('give every mapped material a kind with a part', () => {
    // Arrange
    const materials = Object.values(LDRAW_PARTICLE_MATERIALS)

    // Act
    const missing = materials.filter((material) => !(material.kind in LDRAW_PARTICLE_PARTS))

    // Assert
    expect([materials.length > 0, missing]).toEqual([true, []])
  })
})
