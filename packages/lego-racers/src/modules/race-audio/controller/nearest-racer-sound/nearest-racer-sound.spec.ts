import { getNearestRacerSound } from './nearest-racer-sound.ts'
import type { NearestRacerCandidate } from './nearest-racer-sound.types.ts'

const createCandidate = (racerIndex: number, x: number): NearestRacerCandidate =>
  Object.freeze({
    racerIndex,
    position: Object.freeze({ x, y: 0, z: 0 }),
    velocity: Object.freeze({ x: 0.5, y: 0, z: 0 }),
    speed: 0.17,
    engineSoundValue: 1,
    airborneMilliseconds: 0,
  })

describe('getNearestRacerSound', () => {
  it('picks the racer nearest to the listener within 200 units and doubles its velocity (0x0043c1b0)', () => {
    // Arrange
    const candidates = [createCandidate(0, 0), createCandidate(1, 150), createCandidate(2, 50)]

    // Act
    const sound = getNearestRacerSound(0, candidates)

    // Assert
    expect(sound?.racerIndex).toBe(2)
    expect(sound?.velocity.x).toBe(1)
    expect(sound?.pitch).toBeCloseTo(0.9, 5)
  })

  it('is silent when every other racer is 200 units away or further', () => {
    // Arrange
    const candidates = [createCandidate(0, 0), createCandidate(1, 200), createCandidate(2, 500)]

    // Act
    const sound = getNearestRacerSound(0, candidates)

    // Assert
    expect(sound).toBeNull()
  })
})
