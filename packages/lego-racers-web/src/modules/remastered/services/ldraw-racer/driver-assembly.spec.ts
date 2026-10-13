import { getCatalogueDriverParts } from './driver-assembly.ts'

const ROCKET_RACER_BYTES = [1, 28, 15, 18, 0]
const CAPTAIN_BYTES = [4, 4, 24, 10, 0]

const getText = (bytes: readonly number[]): readonly string[] =>
  (getCatalogueDriverParts(bytes) ?? []).map(
    (entry) =>
      `${entry.role} ${entry.part.partName} ${String(entry.part.colorCode)} ${entry.part.position
        .map((value) => Number(value.toFixed(3)))
        .join(' ')}`
  )

describe('getCatalogueDriverParts', () => {
  it('assembles the mapped pieces into the role list of a driver file, in the standing rest pose', () => {
    // Arrange
    const bytes = ROCKET_RACER_BYTES

    // Act
    const parts = getText(bytes)

    // Assert
    expect(parts).toEqual([
      'hips 3815b.dat 71 0 0 0',
      'left-leg 3817b.dat 71 0 12 0',
      'right-leg 3816b.dat 71 0 12 0',
      'torso 973.dat 7 0 -32 0',
      'head 3626cp40.dat 14 0 -56 0',
      'hat 3842a.dat 0 0 -56 0',
      'accessory 2447.dat 40 0 -56 0',
      'left-arm 3819.dat 4 15.552 -23 0',
      'left-hand 3820.dat 0 23.69 -5.226 -9.898',
      'right-arm 3818.dat 1 -15.552 -23 0',
      'right-hand 3820.dat 0 -23.69 -5.226 -9.898',
    ])
  })

  it('gives a hook torso a hook for the left hand and a peg leg its peg', () => {
    // Arrange
    const bytes = CAPTAIN_BYTES

    // Act
    const parts = getText(bytes)

    // Assert
    expect(parts.filter((part) => /^(left-hand|right-leg) /.test(part))).toEqual([
      'right-leg 2532.dat 6 0 12 0',
      'left-hand 2531.dat 8 23.69 -5.226 -9.898',
    ])
  })

  it('knows no figure with a piece the catalogue does not have', () => {
    // Arrange / Act
    const parts = getCatalogueDriverParts([99, 0, 0, 0, 0])

    // Assert
    expect(parts).toBeNull()
  })
})
