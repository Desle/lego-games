import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import { HazardKeyword, HazardLifecycle } from '../../../hazard/index.ts'
import { PauseMenuMode } from '../../../race/index.ts'
import type { RaceState } from '../../../race/index.ts'
import { getBoundingInterval } from '../../../racer-collision/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { TrackEvent } from '../../../track-logic/index.ts'
import { getSkeletonInstanceFlags } from '../../../world-animation/index.ts'
import type { WorldAnimation } from '../../../world-animation/index.ts'
import type { TraceFieldProvider, TraceFields } from '../../types/golden-trace.types.ts'
import { getFloatWords, getVectorWords } from '../trace-words/trace-words.ts'

const PLAYING_FLAG = 2
const LOOPING_FLAG = 4

const EVENT_KINDS = [
  'kind_2a',
  'kind_28',
  'kind_29',
  'kind_3d',
  'kind_42',
  'kind_4b',
  'kind_52',
  'kind_4d',
  'kind_51',
  'kind_53',
  'kind_55',
  'kind_59',
] as const

const getEventWords = (event: TrackEvent): readonly number[] => {
  const base = [event.identifier >>> 0, event.state >>> 0, event.flags >>> 0]
  if (event.kind === 'kind_2a') return [...base, event.timerMilliseconds >>> 0]
  if (event.kind === 'kind_4b') {
    return [...base, event.timerMilliseconds >>> 0, event.isSignalHeld ? 1 : 0]
  }
  if (event.kind === 'kind_59') return [...base, event.isSignalHeld ? 1 : 0]
  return base
}

const getWorldFields = (name: string, world: WorldAnimation): TraceFields => ({
  [`track.world.${name}.materials`]: world.materialAnimations.flatMap((animation) =>
    animation.entries.flatMap((entry) => [
      (entry.isPlaying ? PLAYING_FLAG : 0) | (entry.isLooping ? LOOPING_FLAG : 0),
      getBitsFromFloat(entry.time),
    ])
  ),
  [`track.world.${name}.skeletons`]: world.skeletonInstances.flatMap((instance) => {
    const { clip } = instance
    return [
      getSkeletonInstanceFlags(instance),
      getBitsFromFloat(clip?.clip.timeInFrames ?? 0),
      getBitsFromFloat(clip?.secondClip.timeInFrames ?? 0),
      clip?.clip.clipIndex ?? 0,
      getBitsFromFloat(clip?.blendFactor ?? 0),
      ...instance.position.map(getBitsFromFloat),
    ]
  }),
})

const getSkyWords = (sky: NonNullable<RaceState['sky']>): readonly number[] => [
  ...sky.state.progress.flatMap((entry) => [
    entry.elapsedMilliseconds >>> 0,
    entry.keyframeIndex >>> 0,
  ]),
  sky.state.previousSettingIndex,
  sky.state.currentSettingIndex,
  sky.state.blendDurationMilliseconds,
  sky.state.blendElapsedMilliseconds,
]

const getRacerFlowFields = (raceState: RaceState): TraceFields =>
  Object.fromEntries(
    raceState.racerSet.racers.flatMap((racer, index) => [
      [`racer${String(index)}.flow.lapCount`, [racer.lapCount]],
      [`racer${String(index)}.flow.lapTimes`, racer.lapMilliseconds.map((value) => value >>> 0)],
      [
        `racer${String(index)}.flow.countdowns`,
        [
          racer.unidentifiedCountdownD74Milliseconds,
          racer.wrongWayMilliseconds,
          racer.timedEffectMilliseconds,
          racer.timedEffectCharge,
          racer.unidentifiedCountdownD84Milliseconds,
        ].map((value) => value >>> 0),
      ],
    ])
  )

// The hammers' registration, rigid body and figure, in the order track_trace.py `read_hammers` reads them.
const getHammerWords = (
  hazards: RaceState['trackLogic']['hazards']['instances'],
  world: WorldAnimation
): readonly number[] =>
  hazards.flatMap((hazard) => {
    const { data } = hazard
    if (data.keyword !== HazardKeyword.HAZARD_3E) return []
    const { body } = data
    const instance = world.skeletonInstances[data.instance?.index ?? -1]
    const { box, sphere } = body
    const interval = getBoundingInterval(createFloatArithmetic(RACE_FPU_PRECISION), sphere)
    return [
      hazard.lifecycle === HazardLifecycle.ACTIVE ? 1 : 0,
      ...getVectorWords(box.centre),
      ...getFloatWords([body.inverseMass]),
      ...getVectorWords(box.dimensions),
      ...getFloatWords([box.scale]),
      ...getVectorWords(sphere.centre),
      ...getFloatWords([sphere.radius, interval.minimum, interval.maximum]),
      ...getFloatWords(box.rotation),
      ...getFloatWords(instance?.rotation ?? []),
      ...getFloatWords(instance?.position ?? []),
    ]
  })

// The capture hazards' sphere, held racer flag, hold timer, phase and phase timer (track_trace.py `read_captures`).
const getCaptureWords = (
  hazards: RaceState['trackLogic']['hazards']['instances']
): readonly number[] =>
  hazards.flatMap((hazard) => {
    const { data } = hazard
    if (data.keyword !== HazardKeyword.HAZARD_48) return []
    const { centre, radius } = data.sphere
    return [
      ...getFloatWords([centre[0], centre[1], centre[2], radius]),
      data.capturedRacer === null ? 0 : 1,
      data.holdMilliseconds >>> 0,
      data.phase >>> 0,
      data.phaseMilliseconds >>> 0,
    ]
  })

// Race +0x30c0, as track_trace.py reads it.
const PAUSE_MENU_MODE_NUMBERS: Readonly<Record<RaceState['pauseMenu']['mode'], number>> =
  Object.freeze({
    [PauseMenuMode.NONE]: 0,
    [PauseMenuMode.PAUSED]: 1,
    [PauseMenuMode.RESULTS]: 2,
    // @check-allow traced-constants: race +0x30c0 is 3 for the confirmation menu (0x00436160 compares it with 3)
    [PauseMenuMode.CONFIRMATION]: 3,
  })

// The race flow and track logic fields the emulator side reads (reverse-engineering/emulator/track_trace.py).
const KICK_TIMER_MILLISECONDS = 0x2ee

export const getTrackFields: TraceFieldProvider = (raceState) => {
  const { trackLogic, sky } = raceState
  return {
    ...Object.fromEntries(
      EVENT_KINDS.map((kind) => [
        `track.events.${kind.slice(5)}`,
        trackLogic.events[kind].flatMap(getEventWords),
      ])
    ),
    'track.hazards': trackLogic.hazards.instances.flatMap((hazard) => [
      hazard.identifier >>> 0,
      hazard.lifecycle,
    ]),
    'track.hammers': getHammerWords(trackLogic.hazards.instances, trackLogic.worlds.track),
    'track.captures': getCaptureWords(trackLogic.hazards.instances),
    'track.surfaces': [...raceState.surfaces.trackMaterials.values()].map(
      (material) => material.flags >>> 0
    ),
    'track.triggers.main': trackLogic.triggers.main.flatMap((trigger) => [
      trigger.flags & 3,
      trigger.racerMask >>> 0,
      trigger.previousRacerMask >>> 0,
    ]),
    'track.triggers.environment': trackLogic.triggers.environment.map(
      (trigger) => trigger.flags & 3
    ),
    'track.timers': trackLogic.timers.timers.flatMap((timer) => [
      timer.remainingStartMilliseconds >>> 0,
      timer.isSecondPhase ? 1 : 0,
    ]),
    'track.timeList': [
      // The kick timers 0x00438e60 registers (750 ms each) sit at the head of the same list.
      ...raceState.racerSet.racers.flatMap((racer) =>
        racer.contactTimerMilliseconds === null
          ? []
          : [KICK_TIMER_MILLISECONDS, racer.contactTimerMilliseconds >>> 0]
      ),
      ...trackLogic.timers.entries.flatMap((entry) => [
        entry.delayMilliseconds >>> 0,
        entry.elapsedMilliseconds >>> 0,
      ]),
    ],
    ...getWorldFields('track', trackLogic.worlds.track),
    ...getWorldFields('blended', trackLogic.worlds.blended),
    ...getWorldFields('local', trackLogic.worlds.local),
    ...(sky === null ? {} : getWorldFields('sky', sky.background)),
    'track.sky': sky === null ? [] : getSkyWords(sky),
    'race.finishedCount': [raceState.finishedRacerCount],
    'race.isRunning': [raceState.isRunning ? 1 : 0],
    'race.pauseState': [PAUSE_MENU_MODE_NUMBERS[raceState.pauseMenu.mode]],
    'race.unidentifiedCountdown': [raceState.unidentifiedCountdownMilliseconds >>> 0],
    'race.placements': raceState.placements.map((place) => place & 0xffff),
    ...getRacerFlowFields(raceState),
  }
}
