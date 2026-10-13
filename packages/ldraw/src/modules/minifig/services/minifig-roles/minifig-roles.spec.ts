import { findMinifigRole, getMinifigRoles } from './minifig-roles.ts'
import { MinifigRole } from './minifig-roles.types.ts'
import type { MinifigPartPlacement } from './minifig-roles.types.ts'

const getPart = (partName: string, x: number, y: number): MinifigPartPlacement =>
  Object.freeze({ partName, position: [x, y, 0] as const })

const FIGURE: readonly MinifigPartPlacement[] = [
  getPart('3815b.dat', 0, 0),
  getPart('3817b.dat', 0, 12),
  getPart('3816b.dat', 0, 12),
  getPart('973p01.dat', 0, -32),
  getPart('3626b.dat', 0, -56),
  getPart('3842a.dat', 0, -56),
  getPart('3819.dat', 15.552, -23),
  getPart('3818.dat', -15.552, -23),
  getPart('3820.dat', 23.69, -5.226),
  getPart('parts\\2531.DAT', -23.69, -5.226),
  // Something held at the chest that is no minifigure part.
  getPart('3069b.dat', 0, -20),
]

describe('getMinifigRoles', () => {
  it('recognises the minifigure parts by number, a sided part by its side and anything else by where it sits', () => {
    // Arrange
    const parts = FIGURE

    // Act
    const roles = getMinifigRoles(parts).map((entry) => entry.role)

    // Assert
    expect(roles).toEqual([
      MinifigRole.HIPS,
      MinifigRole.LEFT_LEG,
      MinifigRole.RIGHT_LEG,
      MinifigRole.TORSO,
      MinifigRole.HEAD,
      MinifigRole.HAT,
      MinifigRole.LEFT_ARM,
      MinifigRole.RIGHT_ARM,
      MinifigRole.LEFT_HAND,
      MinifigRole.RIGHT_HAND,
      MinifigRole.TORSO,
    ])
  })

  it("takes the caller's hint for a part over its number", () => {
    // Arrange
    const hints = new Map([
      [5, MinifigRole.ACCESSORY],
      [8, MinifigRole.RIGHT_HAND],
    ])

    // Act
    const roles = getMinifigRoles(FIGURE, hints)

    // Assert
    expect([roles[5]?.role, roles[8]?.role, roles[8]?.part]).toEqual([
      MinifigRole.ACCESSORY,
      MinifigRole.RIGHT_HAND,
      FIGURE[8],
    ])
  })
})

describe('findMinifigRole', () => {
  it('reads a role by its name, whatever its case, and knows no other', () => {
    // Arrange
    const names = [' Left-Hand ', 'hat', 'cape']

    // Act
    const roles = names.map(findMinifigRole)

    // Assert
    expect(roles).toEqual([MinifigRole.LEFT_HAND, MinifigRole.HAT, null])
  })
})
