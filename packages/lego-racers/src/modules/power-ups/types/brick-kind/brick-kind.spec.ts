import {
  BrickKind,
  getBrickKindCode,
  getBrickKindFromCode,
  getRaceModeBrickKind,
  UnknownBrickKindError,
} from './brick-kind.ts'

describe('getBrickKindFromCode', () => {
  it('maps 1..4 to projectile, shield, turbo and hazard (0x0045ba90 models P, S, T, M)', () => {
    // Arrange
    const codes = [1, 2, 3, 4]

    // Act
    const kinds = codes.map(getBrickKindFromCode)

    // Assert
    expect(kinds).toEqual([
      BrickKind.PROJECTILE,
      BrickKind.SHIELD,
      BrickKind.TURBO,
      BrickKind.HAZARD,
    ])
    expect(kinds.map(getBrickKindCode)).toEqual(codes)
  })

  it('rejects other codes', () => {
    // Arrange
    const code = 5

    // Act
    const getKind = () => getBrickKindFromCode(code)

    // Assert
    expect(getKind).toThrow(UnknownBrickKindError)
  })
})

describe('getRaceModeBrickKind', () => {
  it('checks 0x44, then 0x08, then 0x10 (0x00458a80)', () => {
    // Arrange
    const kind = BrickKind.SHIELD

    // Act
    const kinds = [0x04, 0x40, 0x08 | 0x10, 0x10, 0x01].map((flags) =>
      getRaceModeBrickKind(kind, flags)
    )

    // Assert
    expect(kinds).toEqual([
      BrickKind.PROJECTILE,
      BrickKind.PROJECTILE,
      BrickKind.HAZARD,
      BrickKind.TURBO,
      BrickKind.SHIELD,
    ])
  })
})
