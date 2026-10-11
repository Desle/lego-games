import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import type { RaceState } from '../../../race/index.ts'
import type { TrackEvent } from '../../../track-logic/index.ts'
import { getSkeletonInstanceFlags } from '../../../world-animation/index.ts'
import type { WorldAnimation } from '../../../world-animation/index.ts'
import type { TraceFields } from '../../types/golden-trace.types.ts'

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

// The race flow and track logic fields the emulator side reads (reverse-engineering/emulator/track_trace.py).
export const getTrackFields = (raceState: RaceState): TraceFields => {
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
    'track.timeList': trackLogic.timers.entries.flatMap((entry) => [
      entry.delayMilliseconds >>> 0,
      entry.elapsedMilliseconds >>> 0,
    ]),
    ...getWorldFields('track', trackLogic.worlds.track),
    ...getWorldFields('blended', trackLogic.worlds.blended),
    ...getWorldFields('local', trackLogic.worlds.local),
    ...(sky === null ? {} : getWorldFields('sky', sky.background)),
    'track.sky': sky === null ? [] : getSkyWords(sky),
    'race.finishedCount': [raceState.finishedRacerCount],
    'race.isRunning': [raceState.isRunning ? 1 : 0],
    'race.pauseState': [raceState.pauseMenu.mode === 'none' ? 0 : 1],
    'race.unidentifiedCountdown': [raceState.unidentifiedCountdownMilliseconds >>> 0],
    'race.placements': raceState.placements.map((place) => place & 0xffff),
    ...getRacerFlowFields(raceState),
  }
}
