import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Box3, Vector3 } from 'three'
import { LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import {
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
    const matrix = getPowerUpObjectMatrix(original, file)
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
    const drawn = corner.clone().applyMatrix4(getPowerUpObjectMatrix(original, builtBounds))

    // Assert
    expect(getRounded(drawn)).toEqual([1, 2, 4])
    expect(getRounded(new Vector3(1, 2, 4).applyMatrix4(reference))).toEqual(
      getRounded(
        new Vector3(1 / POWER_UP_STUD_UNITS, 2 / POWER_UP_STUD_UNITS, 4 / POWER_UP_STUD_UNITS)
      )
    )
  })
})
