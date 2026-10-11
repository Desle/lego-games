import { getSoundLocation } from '../get-sound-location/get-sound-location.ts'
import { getRaceEventSounds, POWER_UP_SOUND_SITES } from './race-sounds.ts'

describe('getSoundLocation', () => {
  it.each([
    [5, 'general', 5],
    [999, 'general', 999],
    [1000, 'voice', 0],
    [1099, 'voice', 99],
    [1100, 'voice_folder', 0],
    [2999, 'voice_folder', 1899],
    [3000, 'track', 0],
    [3017, 'track', 17],
  ])('puts id %i in the %s bank at entry %i', (soundId, bank, index) => {
    // Arrange / Act
    const location = getSoundLocation(soundId)

    // Assert
    expect(location).toEqual({ bank, index })
  })
})

describe('getRaceEventSounds', () => {
  it('plays the start sound when the introduction ends', () => {
    // Arrange
    const event = {
      type: 'race.phase_changed',
      from: 'introduction',
      to: 'countdown',
    } as const

    // Act
    const sounds = getRaceEventSounds(event)

    // Assert
    expect(sounds.map((sound) => sound.soundId)).toEqual([0x3e])
  })

  it('makes no sound for other phase changes', () => {
    // Arrange
    const event = { type: 'race.phase_changed', from: 'countdown', to: 'racing' } as const

    // Act
    const sounds = getRaceEventSounds(event)

    // Assert
    expect(sounds).toEqual([])
  })

  it('plays the turbo level sound and the turbo sound for a turbo start', () => {
    // Arrange
    const event = {
      type: 'race.power_up',
      event: { type: 'power_ups.racer_turbo_started', racer: 0, level: 2, boostMilliseconds: 250 },
    } as const

    // Act
    const sounds = getRaceEventSounds(event)

    // Assert
    expect(sounds.map((sound) => sound.soundId)).toEqual([0x26, 0x41])
  })

  it('plays the sound the shield drew', () => {
    // Arrange
    const event = {
      type: 'race.power_up',
      event: { type: 'power_ups.racer_shield_struck', racer: 1, sound: 0x46 },
    } as const

    // Act
    const sounds = getRaceEventSounds(event)

    // Assert
    expect(sounds.map((sound) => sound.soundId)).toEqual([0x46])
  })

  it('tells an oil slick spin-out from a rocket hit by its strength', () => {
    // Arrange
    const spun = (strength: number) =>
      ({
        type: 'race.power_up',
        event: { type: 'power_ups.racer_spun_out', racer: 0, strength },
      }) as const

    // Act
    const oil = getRaceEventSounds(spun(1))
    const rocket = getRaceEventSounds(spun(2))

    // Assert
    expect(oil).toEqual([POWER_UP_SOUND_SITES.oilSlickHit])
    expect(rocket).toEqual([POWER_UP_SOUND_SITES.rocketHit])
  })

  it('plays the grapple hit, snap and release sounds', () => {
    // Arrange
    const grappled = {
      type: 'race.power_up',
      event: { type: 'power_ups.racer_grappled', racer: 1, owner: 0 },
    } as const
    const released = {
      type: 'race.power_up',
      event: { type: 'power_ups.grapple_released', effect: 3 },
    } as const

    // Act
    const hit = getRaceEventSounds(grappled)
    const snap = getRaceEventSounds(released)

    // Assert
    expect(hit.map((sound) => sound.soundId)).toEqual([0x12])
    expect(snap.map((sound) => sound.soundId)).toEqual([0x16, 0x49])
  })
})
