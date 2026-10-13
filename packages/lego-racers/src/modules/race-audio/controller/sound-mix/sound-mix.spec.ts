import { getSoundMix } from './sound-mix.ts'

// Values recorded from the original's sound objects (0x00417de0) and DirectSound buffers in the emulator: the listener is
// the human racer at (368.337, 193.960, 0.2) heading along +y, so its left axis is (-1, 0.00873, 0).
const LISTENER = Object.freeze({
  position: Object.freeze({ x: 368.33721923828125, y: 193.96038818359375, z: 0.19997043907642365 }),
  left: Object.freeze({ x: -0.9999619722366333, y: 0.00873106811195612, z: 0 }),
})

const createSource = (x: number, y: number, z: number) =>
  Object.freeze({
    position: Object.freeze({ x, y, z }),
    minimumDistance: 30,
    maximumDistance: 300,
    volume: 1,
    pitch: 1,
  })

describe('getSoundMix', () => {
  it('plays a sound inside the minimum distance at its own volume and pans it to the left (0x00417de0)', () => {
    // Arrange
    const source = createSource(356.9742126464844, 210.83563232421875, 0.199971005320549)

    // Act
    const mix = getSoundMix(LISTENER, source)

    // Assert: the original gave DirectSound a volume of 0 and a pan of -560.
    expect(mix.directSoundVolume).toBe(0)
    expect(mix.directSoundPan).toBe(-560)
  })

  it('fades a sound linearly in the squared distance beyond the minimum', () => {
    // Arrange
    const source = createSource(336.1696472167969, 210.708740234375, 0.199972003698349)

    // Act
    const mix = getSoundMix(LISTENER, source)

    // Assert: the original gave DirectSound a volume of -14.
    expect(mix.directSoundVolume).toBe(-14)
  })

  it('silences a sound beyond the maximum distance', () => {
    // Arrange
    const source = createSource(1000, 1000, 0)

    // Act
    const mix = getSoundMix(LISTENER, source)

    // Assert
    expect(mix.volume).toBe(0)
    expect(mix.directSoundVolume).toBe(-10000)
  })

  it('does not pan a sound that is straight ahead', () => {
    // Arrange
    const source = createSource(368.33721923828125, 233.96038818359375, 0.19997043907642365)

    // Act
    const mix = getSoundMix(LISTENER, source)

    // Assert
    expect(Math.abs(mix.directSoundPan)).toBeLessThan(2)
  })
})
