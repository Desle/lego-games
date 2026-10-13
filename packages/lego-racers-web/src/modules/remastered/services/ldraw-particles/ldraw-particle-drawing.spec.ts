import { Box3, Group, Matrix4, Vector3 } from 'three'
import type { PartParticleSlot, PartParticlesSettings } from '@lego-games/ldraw/particles'
import type { ParticleView } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getParticleUnitsPerLDrawUnit } from '../ldraw-powerup/powerup-object-frame.ts'
import {
  createLDrawParticleDrawing,
  getParticleKindModel,
  getParticleOpacity,
  getPieceWidth,
  prepareParticleFiles,
  setParticlePieceMatrix,
} from './ldraw-particle-drawing.ts'
import {
  LDRAW_PARTICLE_MATERIALS,
  LDRAW_PARTICLE_PARTS,
  LDRAW_PARTICLE_REFERENCES,
} from './ldraw-particle-mappings.ts'
import { LDrawParticleKind } from './ldraw-particle-mappings.types.ts'

const drawnCounts: number[] = []
const drawnMatrices: Matrix4[] = []

// The library is not here: the part is a stud wide (20 LDraw units) and each frame's count and matrices are kept.
vi.mock('@lego-games/ldraw/particles', () => ({
  getParticlePartText: (partName: string, colorCode: number) =>
    `1 ${String(colorCode)} 0 0 0 1 0 0 0 1 0 0 0 1 ${partName}.dat`,
  createPartParticles: (settings: PartParticlesSettings) => ({
    object: new Group(),
    shown: Promise.resolve(),
    getModelBounds: () => new Box3(new Vector3(-10, -8, -10), new Vector3(10, 0, 10)),
    setParticles: (count: number, write: (index: number, slot: PartParticleSlot) => void) => {
      drawnCounts.push(Math.min(count, settings.maxCount))
      for (let index = 0; index < count; index += 1) {
        write(index, {
          setMatrix: (matrix) => drawnMatrices.push(matrix.clone()),
          setOpacity: () => undefined,
        })
      }
    },
    dispose: () => undefined,
  }),
}))

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

describe('setParticlePieceMatrix', () => {
  it("draws a piece at its scale at the quad's centre, its studs to the camera", () => {
    // Arrange: a stud is 20 LDraw units at scale 1
    const view = getView('smoke1', 30)

    // Act
    const matrix = setParticlePieceMatrix(new Matrix4(), view, 1, 1 / 20)
    const centre = new Vector3(0, 0, 0).applyMatrix4(matrix)
    const studSide = new Vector3(0, -1, 0).applyMatrix4(matrix).sub(centre)

    // Assert
    expect([
      round(centre),
      round(new Vector3(10, 0, 0).applyMatrix4(matrix)),
      round(new Vector3(0, 0, 10).applyMatrix4(matrix)),
      round(studSide.normalize()),
      matrix.determinant() > 0,
    ]).toEqual([[10, 20, 30], [10.5, 20, 30], [10, 20, 30.5], [0, -1, 0], true])
  })
})

describe('createLDrawParticleDrawing', () => {
  it("draws exactly one piece per original quad of its materials, a big quad's capped at the quad's centre", () => {
    // Arrange: a turbo's smoke, 8 studs across, among small ones
    const drawing = createLDrawParticleDrawing({ materialName: 'tbsmoke1' })
    const big = {
      ...getView('tbsmoke1', 100),
      right: { x: 8, y: 0, z: 0 },
      down: { x: 0, y: 0, z: -8 },
    }
    const views = [getView('tbsmoke1', 100), big, getView('dksmoke2', 75)]
    drawnCounts.length = 0
    drawnMatrices.length = 0

    // Act
    drawing?.setParticles(views)
    drawing?.setParticles([])
    const bigCentre = new Vector3().applyMatrix4(drawnMatrices[1] ?? new Matrix4())
    const bigEdge = new Vector3(10, 0, 0).applyMatrix4(drawnMatrices[1] ?? new Matrix4())

    // Assert: 3 quads, 3 pieces; the big one a stud across (half a stud from its centre to its edge)
    expect([drawnCounts, round(bigCentre), Number(bigEdge.x.toFixed(3))]).toEqual([
      [3, 0],
      [10, 20, 30],
      10.5,
    ])
    drawing?.dispose()
  })
})

describe('getPieceWidth', () => {
  it("measures a piece across the quad: the larger of its LDraw x and z, at the file's scale", () => {
    // Arrange: a 1 x 2 plate lying along z
    const bounds = new Box3(new Vector3(-10, -4, -20), new Vector3(10, 8, 20))

    // Act
    const width = getPieceWidth(bounds, getParticleUnitsPerLDrawUnit(1.5))

    // Assert
    expect(width).toBe(3)
  })
})

describe('getParticleKindModel', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("draws a kind from its file at the file's scale, else from its part at real size", async () => {
    // Arrange
    const text = '0 !RACERS SCALE 0.5\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3005.dat\n'
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(text)))
    const index = {
      cars: {},
      chassis: {},
      drivers: {},
      powerUps: {},
      particles: { WHITE_SMOKE: 'particles/WHITE_SMOKE.ldr' },
    }

    // Act
    await prepareParticleFiles(index)
    const file = getParticleKindModel(LDrawParticleKind.WHITE_SMOKE)
    const part = getParticleKindModel(LDrawParticleKind.DUST)

    // Assert
    expect([file.modelText, file.scale, file.file, part.modelText, part.scale, part.file]).toEqual([
      text,
      0.5,
      'particles/WHITE_SMOKE.ldr',
      '1 28 0 0 0 1 0 0 0 1 0 0 0 1 4073.dat',
      1,
      null,
    ])
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

  it('draw the cannon smoke (dksmoke) white: its material is as white as the turbo smoke', () => {
    // Arrange
    const rows = ['dksmoke1', 'dksmoke4', 'tbsmoke1']

    // Act
    const kinds = rows.map((row) => LDRAW_PARTICLE_MATERIALS[row]?.kind)

    // Assert
    expect(kinds).toEqual([
      LDrawParticleKind.WHITE_SMOKE,
      LDrawParticleKind.WHITE_SMOKE,
      LDrawParticleKind.WHITE_SMOKE,
    ])
  })

  it('give every kind a reference for the builder', () => {
    // Arrange
    const kinds = Object.values(LDrawParticleKind)

    // Act
    const missing = kinds.filter((kind) => !(kind in LDRAW_PARTICLE_REFERENCES))

    // Assert
    expect(missing).toEqual([])
  })
})
