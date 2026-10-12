import type { PowerUpEvent } from '../../../power-ups/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { TrackSoundParameters } from '../../../track-logic/index.ts'
import { RacePhase } from '../../../race/index.ts'
import type { RaceEvent } from '../../../race/index.ts'
import type { LoopedSoundRequest, SoundRequest, SoundSource } from '../../types/race-audio.types.ts'
import { getSoundLocation } from '../get-sound-location/get-sound-location.ts'

const createRequest = (
  soundId: number,
  address: string,
  source: SoundSource | null = null
): SoundRequest => Object.freeze({ soundId, location: getSoundLocation(soundId), address, source })

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

// The distances 0x004b0958 and 0x004b095c (30 and 300) most call sites pass; a track event brings its own.
const DEFAULT_MINIMUM_DISTANCE = 30
const DEFAULT_MAXIMUM_DISTANCE = 300

type PositionTriple = readonly [number, number, number]

const toVector = (triple: PositionTriple): Vector3 =>
  Object.freeze({ x: triple[0], y: triple[1], z: triple[2] })

const getTrackSoundSource = (
  parameters: TrackSoundParameters & { readonly position: PositionTriple }
): SoundSource =>
  Object.freeze({
    position: toVector(parameters.position),
    minimumDistance: parameters.minimumDistance,
    maximumDistance: parameters.maximumDistance,
    volume: parameters.volume,
    pitch: parameters.pitch,
  })

const getHazardSource = (position: PositionTriple | null): SoundSource | null =>
  position === null
    ? null
    : Object.freeze({
        position: toVector(position),
        minimumDistance: DEFAULT_MINIMUM_DISTANCE,
        maximumDistance: DEFAULT_MAXIMUM_DISTANCE,
        volume: 1,
        pitch: 1,
      })

// Where the race's sounds take their positions from: the racers (the original passes the racer's position to
// RaceSounds_PlayAt 0x00443b80).
export type RaceSoundContext = {
  readonly getRacerPosition: (racerIndex: number) => Vector3 | null
  // The human racers have sound objects for the turbo's and the warp's hum (0x00437540); the computers have none.
  readonly getHasSoundObjects: (racerIndex: number) => boolean
}

export const NO_RACE_SOUND_CONTEXT: RaceSoundContext = Object.freeze({
  getRacerPosition: () => null,
  getHasSoundObjects: () => true,
})

// The distances of the call sites that do not pass 30 and 300: the voices (100, 400) and the warp (200, 600).
const SITE_DISTANCES: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  '0x004392ff': [100, 400],
  '0x0045dfca': [200, 600],
})

const getRequestAtRacer = (
  request: SoundRequest,
  racerIndex: number,
  context: RaceSoundContext
): SoundRequest => {
  const position = context.getRacerPosition(racerIndex)
  if (position === null) return request
  const [minimumDistance, maximumDistance] = SITE_DISTANCES[request.address] ?? [
    DEFAULT_MINIMUM_DISTANCE,
    DEFAULT_MAXIMUM_DISTANCE,
  ]
  return Object.freeze({
    ...request,
    source: Object.freeze({ position, minimumDistance, maximumDistance, volume: 1, pitch: 1 }),
  })
}

// The racer a power-up event happens at, for the events that play a sound at a racer.
const getPowerUpEventRacer = (event: PowerUpEvent): number | null => {
  switch (event.type) {
    case 'power_ups.racer_shield_struck':
    case 'power_ups.racer_taunted':
    case 'power_ups.voice':
    case 'power_ups.racer_turbo_started':
    case 'power_ups.racer_spun_out':
    case 'power_ups.racer_struck_by_lightning':
    case 'power_ups.racer_grappled':
    case 'power_ups.racer_magnetized':
      return event.racer
    default:
      return null
  }
}

const getPowerUpEventSounds = (event: PowerUpEvent): readonly SoundRequest[] => {
  switch (event.type) {
    // 0x0043a270 plays the sound it drew (1, 0x46 or 0x47) and the event carries it.
    case 'power_ups.racer_shield_struck':
      return [createRequest(event.sound, '0x0043a2df')]
    // 0x00439240: a driver voice (1000 + r % 6, + 6 for a taunt).
    // 0x00439c90 (Racer_Taunt) plays the racer's taunt sound.
    case 'power_ups.racer_taunted':
      return [createRequest(event.sound, '0x00439cd0')]
    case 'power_ups.sound_played':
      return [createRequest(event.soundId, event.address)]
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
    case 'power_ups.racer_magnetized':
      return [POWER_UP_SOUND_SITES.magnetHit]
    default:
      return []
  }
}

// The sounds a race event makes. Introduction → countdown is where 0x004393d0 marks every local racer as starting
// (0x00439404 plays the start sound); the power-up events play the sounds of the functions that raise them.
export const getRaceEventSounds = (
  event: RaceEvent,
  context: RaceSoundContext = NO_RACE_SOUND_CONTEXT
): readonly SoundRequest[] => {
  if (event.type === 'race.power_up') {
    const racerIndex = getPowerUpEventRacer(event.event)
    const requests = getPowerUpEventSounds(event.event)
    return racerIndex === null
      ? requests
      : requests.map((request) => getRequestAtRacer(request, racerIndex, context))
  }
  if (event.type === 'race.racer_sound') {
    return [
      getRequestAtRacer(createRequest(event.soundId, event.address), event.racerIndex, context),
    ]
  }
  // 0x004642c0 and 0x004643e0: a track event (2A) plays its sound from the track bank (the id is the event's own, 3000 and up).
  if (event.type === 'race.track_effect' && event.effect.type === 'track.sound_played') {
    return [
      createRequest(event.effect.soundNumber, '0x004644aa', getTrackSoundSource(event.effect)),
    ]
  }
  if (event.type === 'race.track_effect' && event.effect.type === 'hazard.sound_played') {
    return [
      createRequest(
        event.effect.soundIdentifier,
        '0x0048ce90',
        getHazardSource(event.effect.position)
      ),
    ]
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

// 0x00437d40: the skid begins with sound 2.
export const getSkidStartSound = (): SoundRequest => createRequest(2, '0x00438450')

// 0x00439870 and 0x004397c0: a player's power slide starts and stops with a sound.
export const getPowerSlideSound = (isStarting: boolean): SoundRequest =>
  isStarting
    ? createRequest(POWER_SLIDE_START_SOUND, '0x0043985b')
    : createRequest(POWER_SLIDE_STOP_SOUND, '0x004398d5')

const SHIELD_LOOP_SOUNDS = Object.freeze([0x4c, 0x35, 0x4d, 0x4e])
// Racer_UpdateLoopedSounds 0x00437be0: the turbo hum of its level (0 to 2) and the warp's.
const TURBO_LOOP_SOUND_BASE = 0x2a
const WARP_LOOP_SOUND = 0x2d
const TURBO_LOOP_LEVEL_COUNT = 3

const getRacerSource = (
  racerIndex: number | null,
  context: RaceSoundContext
): SoundSource | null => {
  const position = racerIndex === null ? null : context.getRacerPosition(racerIndex)
  return position === null
    ? null
    : Object.freeze({
        position,
        minimumDistance: DEFAULT_MINIMUM_DISTANCE,
        maximumDistance: DEFAULT_MAXIMUM_DISTANCE,
        volume: 1,
        pitch: 1,
      })
}

const createLoopRequest = (
  isStart: boolean,
  key: string,
  soundId: number,
  address: string,
  source: SoundSource | null = null,
  followedRacer: number | null = null
): LoopedSoundRequest =>
  Object.freeze({
    isStart,
    key,
    soundId,
    location: getSoundLocation(soundId),
    address,
    source,
    followedRacer,
  })

const getPowerUpEventLoops = (
  event: PowerUpEvent,
  context: RaceSoundContext
): readonly LoopedSoundRequest[] => {
  switch (event.type) {
    // 0x0045bd30 (the shield's set-up) loops the sound of its level on the racer.
    case 'power_ups.racer_shield_raised':
      return [
        createLoopRequest(
          true,
          `shield:${String(event.racer)}`,
          SHIELD_LOOP_SOUNDS[event.level] ?? SHIELD_LOOP_SOUNDS[0] ?? 0,
          '0x0045bdd9',
          getRacerSource(event.racer, context),
          event.racer
        ),
      ]
    case 'power_ups.racer_shield_lowered':
      return [createLoopRequest(false, `shield:${String(event.racer)}`, 0, '0x0045c2fc')]
    // 0x00437be0: a racer in a turbo of level 0 to 2 hums with it, one in a warp with the warp's sound.
    case 'power_ups.racer_turbo_started':
      return event.level < TURBO_LOOP_LEVEL_COUNT && context.getHasSoundObjects(event.racer)
        ? [
            createLoopRequest(
              true,
              `turbo:${String(event.racer)}`,
              TURBO_LOOP_SOUND_BASE + event.level,
              '0x00437c4b',
              getRacerSource(event.racer, context),
              event.racer
            ),
          ]
        : []
    case 'power_ups.racer_turbo_ended':
      return [createLoopRequest(false, `turbo:${String(event.racer)}`, 0, '0x00437cc7')]
    case 'power_ups.racer_warp_started':
      return !context.getHasSoundObjects(event.racer)
        ? []
        : [
            createLoopRequest(
              true,
              `warp:${String(event.racer)}`,
              WARP_LOOP_SOUND,
              '0x00437cbe',
              getRacerSource(event.racer, context),
              event.racer
            ),
          ]
    case 'power_ups.racer_warp_ended':
      return [createLoopRequest(false, `warp:${String(event.racer)}`, 0, '0x00437cc7')]
    case 'power_ups.looped_sound_started':
      return [
        createLoopRequest(
          true,
          event.key,
          event.soundId,
          event.address,
          getRacerSource(event.ownerRacer, context)
        ),
      ]
    case 'power_ups.looped_sound_stopped':
      return [createLoopRequest(false, event.key, 0, event.address)]
    default:
      return []
  }
}

// The looped sounds a race event starts (RaceSounds_Get 0x00443bd0 and slot +4 with 1) or stops.
export const getRaceEventLoops = (
  event: RaceEvent,
  context: RaceSoundContext = NO_RACE_SOUND_CONTEXT
): readonly LoopedSoundRequest[] => {
  if (event.type === 'race.power_up') return getPowerUpEventLoops(event.event, context)
  // A racer's looped sound (the surface its wheels run on, 0x0042af90) follows the racer.
  if (event.type === 'race.racer_loop') {
    return [
      createLoopRequest(
        event.isStart,
        event.key,
        event.soundId,
        event.address,
        event.isStart ? getRacerSource(event.racerIndex, context) : null,
        event.isStart ? event.racerIndex : null
      ),
    ]
  }
  if (event.type !== 'race.track_effect') return []
  const { effect } = event
  switch (effect.type) {
    // 0x004642c0: a looped 2A event keeps the sound object on its position.
    case 'track.looped_sound_started':
      return [
        createLoopRequest(
          true,
          `track:${String(effect.identifier)}`,
          effect.soundNumber,
          '0x004642c0',
          getTrackSoundSource(effect)
        ),
      ]
    case 'track.looped_sound_stopped':
      return [createLoopRequest(false, `track:${String(effect.identifier)}`, 0, '0x004643b0')]
    case 'hazard.looped_sound_started':
      return [
        createLoopRequest(
          true,
          `hazard:${String(effect.keyword)}`,
          effect.soundIdentifier,
          '0x0048cac0'
        ),
      ]
    case 'hazard.looped_sound_stopped':
      return [createLoopRequest(false, `hazard:${String(effect.keyword)}`, 0, '0x0048cb60')]
    default:
      return []
  }
}
