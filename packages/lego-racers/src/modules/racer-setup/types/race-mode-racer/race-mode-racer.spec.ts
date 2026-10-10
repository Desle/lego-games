import {
  getIsCarBodyFlagged,
  getRaceModeRacerFlags,
  getRacerPowerUpAbilities,
} from './race-mode-racer.ts'

describe('race mode racer flags', () => {
  it('sets no racer flag and no ability for the normal race mode', () => {
    // Arrange
    const raceModeFlags = 0

    // Act
    const flags = getRaceModeRacerFlags(raceModeFlags)
    const abilities = getRacerPowerUpAbilities(raceModeFlags)

    // Assert
    expect(flags).toBe(0)
    expect(abilities).toEqual({
      isAlwaysGrapple: false,
      isAlwaysLevelThree: false,
      isPermanentTurbo: false,
    })
  })

  it('maps bits 0x1, 0x2, 0x40 and 0x80 to racer flags 0x4000000, 0x8000000, 0x1000000, 0x2000000 (0x00436df0)', () => {
    // Arrange
    const bits = [0x1, 0x2, 0x40, 0x80]

    // Act
    const flags = bits.map(getRaceModeRacerFlags)

    // Assert
    expect(flags).toEqual([0x4000000, 0x8000000, 0x1000000, 0x2000000])
  })

  it('ignores the bits that other code reads, such as the time scale 0x100', () => {
    // Arrange
    const raceModeFlags = 0x100 | 0x4 | 0x8 | 0x10

    // Act
    const flags = getRaceModeRacerFlags(raceModeFlags)

    // Assert
    expect(flags).toBe(0)
    expect(getIsCarBodyFlagged(raceModeFlags)).toBe(false)
  })

  it('reads the abilities from the same bits', () => {
    // Arrange
    const raceModeFlags = 0x2 | 0x80

    // Act
    const abilities = getRacerPowerUpAbilities(raceModeFlags)

    // Assert
    expect(abilities).toEqual({
      isAlwaysGrapple: false,
      isAlwaysLevelThree: true,
      isPermanentTurbo: true,
    })
  })
})
