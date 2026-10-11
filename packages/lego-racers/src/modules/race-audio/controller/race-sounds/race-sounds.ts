import type { PowerUpEvent } from '../../../power-ups/index.ts'
import { RacePhase } from '../../../race/index.ts'
import type { RaceEvent } from '../../../race/index.ts'
import type { SoundRequest } from '../../types/race-audio.types.ts'
import { getSoundLocation } from '../get-sound-location/get-sound-location.ts'

const createRequest = (soundId: number, address: string): SoundRequest =>
  Object.freeze({ soundId, location: getSoundLocation(soundId), address })

// Sound ids are entries of GENERAL.SBK (ids below 1000), counted from 0.
const COUNTDOWN_SECOND_SOUND = 0
const GO_SOUND = 0xf
const RACE_START_SOUND = 0x3e
const POWER_SLIDE_START_SOUND = 0x39
const POWER_SLIDE_STOP_SOUND = 0x41
const TURBO_LEVEL_SOUND_BASE = 0x24
const TURBO_START_SOUND = 0x41
const OIL_SLICK_HIT_SOUND = 0x2f
const ROCKET_HIT_SOUND = 0x32
const WAND_HIT_SOUND = 0x43
const GRAPPLE_HIT_SOUND = 0x12
const GRAPPLE_SNAP_SOUND = 0x16
const GRAPPLE_RELEASE_SOUND = 0x49
const MAGNET_HIT_SOUND = 0x23
const OIL_SLICK_STRENGTH = 1
const ROCKET_STRENGTH = 2

// The sound sites of the projectile and hazard code (names from `reverse-engineering/names`), by the stage they
// play at: launch, flight, hit and release. The ids are the first argument of the call to the race's sound player
// 0x00443b80; `.docs/reverse-engineering/race-audio.md` lists the file each id is.
export const POWER_UP_SOUND_SITES = Object.freeze({
  cannonLaunch: createRequest(6, '0x00452362'),
  cannonHit: createRequest(5, '0x00452415'),
  grappleLaunch: createRequest(0x15, '0x004545c0'),
  grappleHit: createRequest(GRAPPLE_HIT_SOUND, '0x0045466f'),
  grappleSnap: createRequest(GRAPPLE_SNAP_SOUND, '0x00454701'),
  grappleRelease: createRequest(GRAPPLE_RELEASE_SOUND, '0x00454724'),
  wandLaunch: createRequest(0x42, '0x004550c3'),
  wandHit: createRequest(WAND_HIT_SOUND, '0x00455610'),
  magnetLaunch: createRequest(0x4a, '0x00455fa4'),
  magnetHit: createRequest(MAGNET_HIT_SOUND, '0x00456080'),
  magnetPlace: createRequest(0x21, '0x00456225'),
  rocketLaunch: createRequest(0x33, '0x00456668'),
  rocketHit: createRequest(ROCKET_HIT_SOUND, '0x00457065'),
  oilSlickDrop: createRequest(0x2e, '0x00457431'),
  oilSlickHit: createRequest(OIL_SLICK_HIT_SOUND, '0x00457633'),
  brickCollect: createRequest(0x48, '0x004578bc'),
  shieldEnd: createRequest(0x3b, '0x0045c2fc'),
})

const getPowerUpEventSounds = (event: PowerUpEvent): readonly SoundRequest[] => {
  switch (event.type) {
    // 0x0043a270 plays the sound it drew (1, 0x46 or 0x47) and the event carries it.
    case 'power_ups.racer_shield_struck':
      return [createRequest(event.sound, '0x0043a2df')]
    // 0x00439240: a driver voice (1000 + r % 6, + 6 for a taunt).
    case 'power_ups.voice':
      return [createRequest(event.sound, '0x004392ff')]
    // 0x0045cd70: the turbo's level sound and the shared turbo sound.
    case 'power_ups.racer_turbo_started':
      return [
        createRequest(TURBO_LEVEL_SOUND_BASE + event.level, '0x0045cde0'),
        createRequest(TURBO_START_SOUND, '0x0045ce06'),
      ]
    case 'power_ups.racer_spun_out':
      if (event.strength === OIL_SLICK_STRENGTH) return [POWER_UP_SOUND_SITES.oilSlickHit]
      return event.strength === ROCKET_STRENGTH ? [POWER_UP_SOUND_SITES.rocketHit] : []
    case 'power_ups.racer_struck_by_lightning':
      return [POWER_UP_SOUND_SITES.wandHit]
    case 'power_ups.racer_grappled':
      return [POWER_UP_SOUND_SITES.grappleHit]
    case 'power_ups.grapple_released':
      return [POWER_UP_SOUND_SITES.grappleSnap, POWER_UP_SOUND_SITES.grappleRelease]
    case 'power_ups.racer_magnetized':
      return [POWER_UP_SOUND_SITES.magnetHit]
    default:
      return []
  }
}

// The sounds a race event makes. Introduction → countdown is where 0x004393d0 marks every local racer as starting
// (0x00439404 plays the start sound); the power-up events play the sounds of the functions that raise them.
export const getRaceEventSounds = (event: RaceEvent): readonly SoundRequest[] => {
  if (event.type === 'race.power_up') return getPowerUpEventSounds(event.event)
  // 0x004642c0 and 0x004643e0: a track event (2A) plays its sound from the track bank (the id is the event's own, 3000 and up).
  if (event.type === 'race.track_effect' && event.effect.type === 'track.sound_played') {
    return [createRequest(event.effect.soundNumber, '0x004644aa')]
  }
  if (
    event.type === 'race.phase_changed' &&
    event.from === RacePhase.INTRODUCTION &&
    event.to === RacePhase.COUNTDOWN
  ) {
    return [createRequest(RACE_START_SOUND, '0x00439404')]
  }
  return []
}

// 0x004263a0: the HUD ticks a countdown second with sound 0 and the start with sound 0xf.
export const getCountdownSound = (soundId: number): SoundRequest =>
  createRequest(soundId, soundId === GO_SOUND ? '0x00426668' : '0x00426540')

export const COUNTDOWN_SOUND_IDS = Object.freeze({
  second: COUNTDOWN_SECOND_SOUND,
  go: GO_SOUND,
})

// 0x00439870 and 0x004397c0: a player's power slide starts and stops with a sound.
export const getPowerSlideSound = (isStarting: boolean): SoundRequest =>
  isStarting
    ? createRequest(POWER_SLIDE_START_SOUND, '0x0043985b')
    : createRequest(POWER_SLIDE_STOP_SOUND, '0x004398d5')
