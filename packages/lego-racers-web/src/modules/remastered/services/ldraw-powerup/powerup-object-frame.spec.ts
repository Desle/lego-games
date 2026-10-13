import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Box3, Vector3 } from 'three'
import { LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import {
  getBuildFrameMatrix,
  getFittedPowerUpScale,
  getFittedSpriteScale,
  getParticleUnitsPerLDrawUnit,
  getOriginalFrameBounds,
  getOriginalModelBounds,
  getPowerUpObjectMatrix,
  getPowerUpReferenceMatrix,
  POWER_UP_STUD_UNITS,
} from './powerup-object-frame.ts'

// Two triangles: the first on bone 1 (the bone of the first vertex), the second on bone 2, far away.
const MODEL: ModelScene = {
  meshScales: [0.5],
  scene: {
    worldPaths: [],
    textures: [],
    materials: [],
    meshes: [
      {
        name: 'rocket',
        path: 'GAMEDATA\\COMMON\\ROCKET.GDB',
        vertexCount: 6,
        positions: new Float32Array([
          -2, -4, 0, 2, 4, 0, 0, 0, 8, 100, 100, 100, 101, 100, 100, 100, 101, 100,
        ]),
        textureCoordinates: new Float32Array(12),
        colors: null,
        normals: null,
        materialIndices: [],
        boundingSphere: null,
        drawBatches: [
          {
            materialSlot: 0,
            firstCommand: 0,
            vertexIndices: new Uint32Array([0, 1, 2, 3, 4, 5]),
            transformIndices: new Uint8Array([1, 1, 1, 2, 2, 2]),
          },
        ],
      },
    ],
    materialAssignments: [],
    bspTrees: [],
    skeletons: [],
    animations: [],
    instances: [],
    sprites: [],
    cameras: [],
    ambientLights: [],
    directionalLights: [],
  },
}

const getRounded = (point: Vector3): readonly number[] =>
  point.toArray().map((value) => Number(value.toFixed(4)) + 0)

describe('the power-up object frame', () => {
  it('takes the bounds of the vertices on the posed bone, the model scale applied', () => {
    // Arrange
    const model = MODEL

    // Act
    const bounds = getOriginalModelBounds(model)

    // Assert
    expect([getRounded(bounds.min), getRounded(bounds.max)]).toEqual([
      [-1, -2, 0],
      [1, 2, 4],
    ])
  })

  it("turns the file's LDraw axes into the game's and fits its largest extent and centre to the original's", () => {
    // Arrange: 40 wide (x), 40 tall (-y), 20 deep (z), standing on y = 0
    const original = getOriginalModelBounds(MODEL)
    const file = new Box3(new Vector3(-20, -40, -10), new Vector3(20, 0, 10))

    // Act
    const matrix = getPowerUpObjectMatrix(original, file, null)
    const top = new Vector3(0, -40, 0).applyMatrix4(matrix)
    const front = new Vector3(0, -20, 10).applyMatrix4(matrix)

    // Assert: a tenth of its size, top on the original's top, depth (LDraw z) along y
    expect([getRounded(top), getRounded(front)]).toEqual([
      [0, 0, 4],
      [0, 1, 2],
    ])
  })

  it('draws a file built on the reference where the builder showed it, at its size', () => {
    // Arrange: the original as the builder shows it, in studs, and the same box as LDraw points
    const original = getOriginalModelBounds(MODEL)
    const reference = getPowerUpReferenceMatrix(original)
    const studsToLDraw = LDRAW_TO_STUDS.clone().invert()
    const builtBounds = original.clone().applyMatrix4(reference).applyMatrix4(studsToLDraw)
    const corner = new Vector3(1, 2, 4).applyMatrix4(reference).applyMatrix4(studsToLDraw)

    // Act
    const drawn = corner.clone().applyMatrix4(getPowerUpObjectMatrix(original, builtBounds, null))

    // Assert
    expect(getRounded(drawn)).toEqual([1, 2, 4])
    expect(getRounded(new Vector3(1, 2, 4).applyMatrix4(reference))).toEqual(
      getRounded(
        new Vector3(1 / POWER_UP_STUD_UNITS, 2 / POWER_UP_STUD_UNITS, 4 / POWER_UP_STUD_UNITS)
      )
    )
  })

  it('draws a file with a scale where the builder shows it: reference after race is the build frame', () => {
    // Arrange
    const original = getOriginalModelBounds(MODEL)
    const points = [new Vector3(0, 0, 0), new Vector3(20, -24, 10), new Vector3(-40, 8, -60)]

    // Act
    const drawn = [0.5, 1, 2.5].flatMap((scale) => {
      const race = getPowerUpObjectMatrix(original, new Box3(), scale)
      const shown = getPowerUpReferenceMatrix(original).multiply(race)
      return points.map((point) => [
        getRounded(point.clone().applyMatrix4(shown)),
        getRounded(point.clone().applyMatrix4(getBuildFrameMatrix(scale))),
      ])
    })

    // Assert
    expect(drawn.every(([race, builder]) => JSON.stringify(race) === JSON.stringify(builder))).toBe(
      true
    )
  })

  it("gives the fit as a scale: the fitted file's largest extent is the original's", () => {
    // Arrange: the original 4 tall (z), the file 80 LDraw units tall (-y)
    const original = getOriginalModelBounds(MODEL)
    const file = new Box3(new Vector3(-10, -80, -10), new Vector3(10, 0, 10))

    // Act
    const scale = getFittedPowerUpScale(original, file)
    const drawnTop = new Vector3(0, -80, 0).applyMatrix4(
      getPowerUpObjectMatrix(original, file, scale)
    )

    // Assert
    expect([
      Number((scale * 80 * (POWER_UP_STUD_UNITS / 20)).toFixed(4)),
      getRounded(drawnTop),
    ]).toEqual([4, [0, 0, 4]])
  })

  it('frames a mesh with no triangle on its posed bone by all its vertices', () => {
    // Arrange: every triangle on another bone than the first vertex's
    const [mesh] = MODEL.scene.meshes
    const batch = mesh?.drawBatches[0]
    if (mesh === undefined || batch === undefined) throw new Error('the model has a mesh')
    const unposed: ModelScene = {
      ...MODEL,
      scene: {
        ...MODEL.scene,
        meshes: [
          {
            ...mesh,
            drawBatches: [{ ...batch, transformIndices: new Uint8Array([1, 2, 2, 1, 2, 2]) }],
          },
        ],
      },
    }

    // Act
    const posed = getOriginalModelBounds(unposed)
    const framed = getOriginalFrameBounds(unposed)

    // Assert
    expect([posed.isEmpty(), getRounded(framed.min), getRounded(framed.max)]).toEqual([
      true,
      [-1, -2, 0],
      [50.5, 50.5, 50],
    ])
  })

  it("fits a power-up sprite's file to the sprite: its largest extent the sprite's size", () => {
    // Arrange: a 2 x 2 round brick, 40 LDraw units across and 24 tall, for the cannon ball's 5 x 5 sprite
    const file = new Box3(new Vector3(-20, -24, -20), new Vector3(20, 0, 20))

    // Act
    const scale = getFittedSpriteScale(5, file)

    // Assert
    expect(Number((40 * getParticleUnitsPerLDrawUnit(scale)).toFixed(4))).toBe(5)
  })
})
