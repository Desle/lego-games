import { getSoundLocation } from '../get-sound-location/get-sound-location.ts'
import { getRaceEventLoops, getRaceEventSounds, POWER_UP_SOUND_SITES } from './race-sounds.ts'

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
        event: { type: 'power_ups.racer_spun_out', racer: 0, strength, spinTime: 0 },
      }) as const

    // Act
    const oil = getRaceEventSounds(spun(1))
    const rocket = getRaceEventSounds(spun(2))

    // Assert
    expect(oil).toEqual([POWER_UP_SOUND_SITES.oilSlickHit])
    expect(rocket).toEqual([POWER_UP_SOUND_SITES.rocketHit])
  })

  it('plays the grapple hit sound; the release sounds come from the effect as sound events', () => {
    // Arrange
    const grappled = {
      type: 'race.power_up',
      event: { type: 'power_ups.racer_grappled', racer: 1, owner: 0 },
    } as const
    const released = {
      type: 'race.power_up',
      event: { type: 'power_ups.grapple_released', effect: 3, victim: 1, owner: 0 },
    } as const

    // Act
    const hit = getRaceEventSounds(grappled)
    const release = getRaceEventSounds(released)

    // Assert
    expect(hit.map((sound) => sound.soundId)).toEqual([0x12])
    expect(release).toEqual([])
  })
})

describe('getRaceEventLoops', () => {
  it('loops the shield hum of its level and ends it with the shield', () => {
    // Arrange
    const raised = {
      type: 'race.power_up',
      event: { type: 'power_ups.racer_shield_raised', racer: 2, level: 1 },
    } as const
    const lowered = {
      type: 'race.power_up',
      event: { type: 'power_ups.racer_shield_lowered', racer: 2 },
    } as const

    // Act
    const started = getRaceEventLoops(raised)
    const stopped = getRaceEventLoops(lowered)

    // Assert
    expect(started.map((loop) => [loop.isStart, loop.key, loop.soundId])).toEqual([
      [true, 'shield:2', 0x35],
    ])
    expect(stopped.map((loop) => [loop.isStart, loop.key])).toEqual([[false, 'shield:2']])
  })

  it('loops the sound of a looped track event on its position and of a hazard', () => {
    // Arrange
    const track = {
      type: 'race.track_effect',
      effect: {
        type: 'track.looped_sound_started',
        identifier: 7,
        soundNumber: 3006,
        position: [1, 2, 3],
        volume: 0.5,
        pitch: 1,
        minimumDistance: 20,
        maximumDistance: 200,
      },
    } as const
    const hazard = {
      type: 'race.track_effect',
      effect: { type: 'hazard.looped_sound_started', keyword: 0x2b, soundIdentifier: 0xbc4 },
    } as const

    // Act
    const trackLoops = getRaceEventLoops(track)
    const hazardLoops = getRaceEventLoops(hazard)

    // Assert
    expect(trackLoops[0]).toMatchObject({
      key: 'track:7',
      soundId: 3006,
      location: { bank: 'track', index: 6 },
      source: {
        position: { x: 1, y: 2, z: 3 },
        minimumDistance: 20,
        maximumDistance: 200,
        volume: 0.5,
      },
    })
    expect(hazardLoops.map((loop) => [loop.key, loop.soundId])).toEqual([['hazard:43', 0xbc4]])
  })

  it('plays the ghost touch sound at the racer', () => {
    // Arrange
    const event = {
      type: 'race.track_effect',
      effect: {
        type: 'hazard.sound_played',
        keyword: 0x2b,
        soundIdentifier: 0xbc7,
        position: [4, 5, 6],
      },
    } as const

    // Act
    const sounds = getRaceEventSounds(event)

    // Assert
    expect(sounds[0]).toMatchObject({ soundId: 0xbc7, source: { position: { x: 4, y: 5, z: 6 } } })
  })
})
