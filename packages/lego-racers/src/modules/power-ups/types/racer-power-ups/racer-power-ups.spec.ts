import { createRandomTable, drawRandomValue } from '../../../random-table/index.ts'
import type { RandomState } from '../power-ups.types.ts'
import {
  createRacerPowerUps,
  getRacerAfterDrop,
  getRacerAfterRelease,
  getRacerVoice,
  getRacerWithEnhancement,
  getRacerWithVoiceCooldownAdvanced,
} from './racer-power-ups.ts'

// The first draw reads table index 0 (the position advances before each read).
const createRandom = (values: readonly number[]): RandomState =>
  Object.freeze({
    table: createRandomTable(
      Array.from({ length: 1024 }, (_, index) => values[index % values.length] ?? 0)
    ),
    position: 1023,
  })

describe('getRacerVoice', () => {
  it('picks base + table % 6 (+ 6 for a taunt) and waits table · 4 + 5000 ms (0x00439240)', () => {
    // Arrange
    const racer = createRacerPowerUps(100, 0)
    const random = createRandom([13, 10, 99])

    // Act
    const complaint = getRacerVoice(racer, random, false)
    const taunt = getRacerVoice(racer, random, true)

    // Assert
    expect(complaint.voiceSound).toBe(101)
    expect(taunt.voiceSound).toBe(107)
    expect(complaint.racer.voiceCooldownMilliseconds).toBe(5040)
    expect(drawRandomValue(complaint.random.table, complaint.random.position).value).toBe(99)
  })

  it('stays silent and draws nothing while the cooldown runs', () => {
    // Arrange
    const racer = createRacerPowerUps(0, 1)
    const random = createRandom([5])

    // Act
    const voice = getRacerVoice(racer, random, true)

    // Assert
    expect(voice.voiceSound).toBeNull()
    expect(voice.random).toBe(random)
  })
})

describe('getRacerWithEnhancement', () => {
  it('fills slots in order and taunts on reaching level 3 (0x00439420)', () => {
    // Arrange
    const random = createRandom([0])
    const first = getRacerWithEnhancement(createRacerPowerUps(0, 0), random, 4)
    const second = getRacerWithEnhancement(first.racer, random, 9)

    // Act
    const third = getRacerWithEnhancement(second.racer, random, 2)
    const fourth = getRacerWithEnhancement(third.racer, random, 5)

    // Assert
    expect(third.racer.enhancementBrickIndices).toEqual([4, 9, 2])
    expect(third.racer.enhancementLevel).toBe(3)
    expect([second.voiceSound, third.voiceSound]).toEqual([null, 6])
    expect(fourth.isAccepted).toBe(false)
  })
})

describe('getRacerAfterDrop and getRacerAfterRelease', () => {
  it('drops the first slot only, and releases all', () => {
    // Arrange
    const random = createRandom([0])
    const one = getRacerWithEnhancement(createRacerPowerUps(0, 0), random, 4).racer
    const two = getRacerWithEnhancement(one, random, 9).racer

    // Act
    const drop = getRacerAfterDrop(two)
    const release = getRacerAfterRelease(drop.racer)

    // Assert
    expect(drop.droppedBrickIndex).toBe(4)
    expect(drop.racer.enhancementLevel).toBe(1)
    expect(release.releasedBrickIndices).toEqual([9])
    expect(release.racer.enhancementLevel).toBe(0)
  })
})

describe('getRacerWithVoiceCooldownAdvanced', () => {
  it('counts down to zero', () => {
    // Arrange
    const racer = createRacerPowerUps(0, 30)

    // Act
    const advanced = [20, 40].map((step) => getRacerWithVoiceCooldownAdvanced(racer, step))

    // Assert
    expect(advanced.map((current) => current.voiceCooldownMilliseconds)).toEqual([10, 0])
  })
})
