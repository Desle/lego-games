import type { Sprite } from '../../../world/index.ts'
import { SceneLinkError } from '../../types/scene-errors/scene-errors.ts'
import type { SceneMaterialAssignment } from '../../types/scene.types.ts'
import { linkSprites } from './link-sprites.ts'
import type { LinkedMaterials } from './load-scene.types.ts'

const LARGEST_FLOAT = 3.4028234663852886e38
const linkedMaterials: LinkedMaterials = {
  materials: [],
  indexByName: new Map([
    ['adtorch', 4],
    ['rktree', 7],
  ]),
}
const assignments: readonly SceneMaterialAssignment[] = [
  { name: 'flame', path: 'flame.gdb', materialIndices: [11, 12] },
]

const createSprite = (overrides: Partial<Sprite>): Sprite => ({
  materialName: 'rktree',
  position: { x: 1, y: 2, z: 3 },
  keyword38Vector: null,
  keyword3aValue: 20,
  keyword3bValue: 25,
  keyword3cValue: 500,
  materialAssignment: null,
  materialAnimation: null,
  ...overrides,
})

describe('linkSprites', () => {
  it('finds the material by name and squares the distance', () => {
    // Arrange
    const sprite = createSprite({ keyword38Vector: { x: 0, y: 0, z: 1 } })

    // Act
    const [linked] = linkSprites('TEST.WDB', [sprite], linkedMaterials, assignments)

    // Assert
    expect(linked).toEqual({
      worldPath: 'TEST.WDB',
      materialIndex: 7,
      position: { x: 1, y: 2, z: 3 },
      axis: { x: 0, y: 0, z: 1 },
      width: 20,
      height: 25,
      squaredDistance: 250000,
    })
  })

  it('leaves a sprite without a distance always in range', () => {
    // Arrange
    const sprite = createSprite({ keyword3cValue: LARGEST_FLOAT })

    // Act
    const [linked] = linkSprites('TEST.WDB', [sprite], linkedMaterials, assignments)

    // Assert
    expect(linked?.squaredDistance).toBe(Infinity)
  })

  it('takes the material of the assignment entry the sprite names', () => {
    // Arrange
    const sprite = createSprite({
      materialName: '',
      materialAssignment: { materialAssignmentIndex: 0, entryIndex: 1 },
    })

    // Act
    const [linked] = linkSprites('TEST.WDB', [sprite], linkedMaterials, assignments)

    // Assert
    expect(linked?.materialIndex).toBe(12)
  })

  it('draws nothing for an assignment entry that does not exist', () => {
    // Arrange
    const sprite = createSprite({
      materialAssignment: { materialAssignmentIndex: 0, entryIndex: 5 },
    })

    // Act
    const [linked] = linkSprites('TEST.WDB', [sprite], linkedMaterials, assignments)

    // Assert
    expect(linked?.materialIndex).toBeNull()
  })

  it.each([
    ['Sprite is missing material name', createSprite({ materialName: '' })],
    ['nothing sprite material not found', createSprite({ materialName: 'nothing' })],
    [
      'Illegal mat assign reference',
      createSprite({ materialAssignment: { materialAssignmentIndex: 3, entryIndex: 0 } }),
    ],
  ])('fails with %s', (message, sprite) => {
    // Arrange / Act
    const link = () => linkSprites('TEST.WDB', [sprite], linkedMaterials, assignments)

    // Assert
    expect(link).toThrow(new SceneLinkError(message))
  })
})
