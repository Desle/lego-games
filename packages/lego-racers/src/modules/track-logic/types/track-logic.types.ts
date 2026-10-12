import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type {
  Event28,
  Event29,
  Event2A,
  Event3D,
  Event42,
  Event4B,
  Event4D,
  Event51,
  Event52,
  Event53,
  Event55,
  Event59,
  EventLink,
  EventPhaseSignals,
  EventSet,
  ObjectReference,
  Vector3,
} from '../../event/index.ts'
import type { EmitterPlacement, EmitterPools, EmitterReference } from '../../emitter/index.ts'
import type {
  HazardBus,
  HazardEffect,
  HazardList,
  HazardRacer,
  HazardRuntime,
} from '../../hazard/index.ts'
import type { LineProbe } from '../../projectiles/index.ts'
import type { RandomTable, RandomTablePosition } from '../../random-table/index.ts'
import type { RaceWorlds } from '../../world-animation/index.ts'
import type { Timer, TimerList } from '../../timer/index.ts'
import type { Trigger, TriggerList } from '../../trigger/index.ts'
import type { FloatArithmetic } from '../../simulation-math/index.ts'
import type { TrackEventKind as TrackEventKindValues } from './track-event-state/track-event-state.ts'

export type TrackEventKind = EnumValues<typeof TrackEventKindValues>

// One event object (base class 0x0045ed40 and the fields of the twelve classes that the port's behaviour reads).
export type TrackEventBase<Kind extends TrackEventKind, Record> = {
  readonly kind: Kind
  // The parsed block the event was made from.
  readonly record: Record
  // +0x14
  readonly identifier: number
  // +0x18
  readonly state: number
  // +0x1c (the class decides the bits; 2 and 4 are common)
  readonly flags: number
  // +0x08, +0x0c, +0x10
  readonly phaseSignals: EventPhaseSignals
  // 2A +0x58 (random sound timer) and 4B +0x28 (countdown)
  readonly timerMilliseconds: number
  // 2A +0x30..+0x38 and 3D +0x3c..+0x44
  readonly position: Vector3
  // 2A +0x54: the chance as a byte (255 plays every time and draws nothing)
  readonly chance: number
  // 2A +0x20 (looped sound)
  readonly isHandleHeld: boolean
  // 3D +0x30 and +0x60: the emitter the event holds (flag +0x1c bit 5 while it does), or null
  readonly emitterHandle: EmitterReference | null
  // 4B byte +0x2c bit 0 and 59 byte +0x34 bit 0: set while the class's second signal is held
  readonly isSignalHeld: boolean
}

export type TrackEvent =
  | TrackEventBase<'kind_2a', Event2A>
  | TrackEventBase<'kind_28', Event28>
  | TrackEventBase<'kind_29', Event29>
  | TrackEventBase<'kind_3d', Event3D>
  | TrackEventBase<'kind_42', Event42>
  | TrackEventBase<'kind_4b', Event4B>
  | TrackEventBase<'kind_4d', Event4D>
  | TrackEventBase<'kind_51', Event51>
  | TrackEventBase<'kind_52', Event52>
  | TrackEventBase<'kind_53', Event53>
  | TrackEventBase<'kind_55', Event55>
  | TrackEventBase<'kind_59', Event59>

// Where a scene object an event names sits: the world and the skeleton instance in it.
export type TrackObjectLocation = {
  readonly key: 'track' | 'blended'
  readonly index: number
}

export type TrackEventAction = 'begin' | 'end' | 'fire' | 'release'

export type TrackEventSet = Readonly<Record<TrackEventKind, readonly TrackEvent[]>>

// What an event or hazard asks of the parts of the game the port does not simulate (rendering, sound, the world's
// animations) or of the racers; each names the original call.
export type TrackEffect =
  | {
      readonly type: 'track.sound_played'
      readonly identifier: number
      // The sound id the event plays (event +0x3c, a track bank id from 3000).
      readonly soundNumber: number
      readonly position: Vector3
    }
  | { readonly type: 'track.looped_sound_started'; readonly identifier: number }
  | { readonly type: 'track.looped_sound_stopped'; readonly identifier: number }
  | {
      readonly type: 'track.object_animation_requested'
      readonly reference: ObjectReference
      readonly requestedAnimation: number
      readonly flags: number
    }
  | {
      readonly type: 'track.event_action'
      readonly kind: TrackEventKind
      readonly identifier: number
      readonly action: TrackEventAction
    }
  | {
      // 0x0045e2a0 (a 42 event's begin) asks Sky_SwitchSetting 0x0041d150 for the named setting.
      readonly type: 'track.sky_setting_switched'
      readonly name: string
      readonly durationMilliseconds: number
    }
  | {
      readonly type: 'track.tagged_position_touched'
      readonly racerIndex: number
      readonly triggerIndex: number
    }
  | {
      readonly type: 'track.racer_zone_entered'
      readonly racerIndex: number
      readonly zone: number
    }
  | {
      readonly type: 'track.racer_target_set'
      readonly racerIndex: number
      readonly target: Vector3 | null
    }
  | {
      // 0x00465600 (0x004400a0) and 0x00465690, 0x004400e0: a 4D event shifts the colours of the racer's models, or ends it.
      readonly type: 'track.racer_colour_shift_changed'
      readonly racerIndex: number
      readonly shifts: readonly [number, number, number, number] | null
      readonly biases: readonly [number, number, number, number]
    }
  | {
      readonly type: 'track.racer_force_changed'
      readonly racerIndex: number
      readonly slot: number
      readonly vector: Vector3 | null
    }
  | HazardEffect

export type TrackWorldObject = {
  // +0xbc: the animation the object plays (a uint16).
  readonly animationIndex: number
  // +0x5c
  readonly flags: number
}

// The parts of the world that events read; the default answers as a world that never animates.
export type TrackWorld = {
  // 29: the material animation (entry +0x14 bit 2) is still playing.
  readonly getIsAnimationPlaying: (identifier: number) => boolean
  // 2A: a sound slot could be taken for a looped sound.
  readonly getIsSoundAvailable: (identifier: number) => boolean
}

export type TrackRandom = {
  readonly table: RandomTable
  readonly position: RandomTablePosition
}

export type TrackLogicContext = {
  readonly arithmetic: FloatArithmetic
  readonly world: TrackWorld
  // What the hazards read of a racer (flags and position); without it no racer is found.
  readonly getHazardRacer?: (racerIndex: number) => HazardRacer | null
  // The cosine table at 0x004bf7ec and the track line probe 0x0041f730, which the hazards read.
  readonly getTableCosine?: (index: number) => number
  readonly probe?: LineProbe
}

// The two emitter pools of the race (see the emitter module).
export type TrackEmitters = EmitterPools

// One timer (0x24 bytes, Timer_Setup 0x00464750): its parsed values and the state Timers_Update and the callback keep.
export type TrackTimer = {
  readonly definition: Timer
  // +0x18: milliseconds left before the timer starts with its first value (0 once started).
  readonly remainingStartMilliseconds: number
  // +0x1c bit 0: the timer is waiting for its first value (the second one has run out).
  readonly isSecondPhase: boolean
}

// An entry of the registry's time list (race +0x4ac, 0x0042fb90): when it has waited its delay, the timer's callback
// 0x004648d0 runs.
export type TimeEntry = {
  readonly timerIndex: number
  readonly delayMilliseconds: number
  readonly elapsedMilliseconds: number
}

export type TrackTimerState = {
  readonly timers: readonly TrackTimer[]
  // The head of the list first: the newest entry is visited first.
  readonly entries: readonly TimeEntry[]
}

// One trigger (main 0x58 bytes, environment 0x3c bytes): the parsed block and the state 0x00464f40 and 0x00464ef0 keep.
export type TrackTrigger = {
  readonly definition: Trigger
  // +0x38 bit 0: touched this frame; bit 1: announced its identifier and not released yet.
  readonly flags: number
  // +0x3c and +0x40: the racers inside this frame and last frame (bit = racer index).
  readonly racerMask: number
  readonly previousRacerMask: number
}

export type TrackTriggerState = {
  readonly main: readonly TrackTrigger[]
  readonly environment: readonly TrackTrigger[]
}

// A racer overlapped a trigger (the registry's callback 0x00463c70 / 0x00464f40); `racer` is null for an
// environment trigger.
export type TrackTriggerContact = {
  readonly isMain: boolean
  readonly triggerIndex: number
  readonly racer: { readonly index: number; readonly currentLap: number } | null
}

export type TrackLogicState = {
  readonly triggers: TrackTriggerState
  readonly timers: TrackTimerState
  readonly events: TrackEventSet
  // Events_Load's 0x39 pairs (event set +0x6c): the first identifier ends the second's events.
  readonly links: readonly EventLink[]
  readonly random: TrackRandom
  // The worlds the hazards and animation events move (race +0x390, +0x398, +0x3a4).
  readonly worlds: RaceWorlds
  readonly hazards: HazardRuntime
  readonly emitters: TrackEmitters
}

// What a timer's callback uses of the session.
export type TrackTimerSession = {
  readonly startSignal: (identifier: number, parameter: Vector3 | null) => void
  readonly stopSignal: (identifier: number, parameter: Vector3 | null) => void
  // value % range below 0x400, otherwise (range / 0x3ff) * value (0x00464830, 0x004648d0).
  readonly drawScaledRange: (range: number) => number
}

// The parsed files a race's track logic is made from.
export type TrackLogicInput = {
  readonly eventSet: EventSet | null
  readonly timerList: TimerList | null
  readonly mainTriggers: TriggerList | null
  readonly environmentTriggers: TriggerList | null
  // The hazard list and the world and emitter state they and the events work on; a race without them has none.
  readonly hazardList?: HazardList | null
  readonly isMirrored?: boolean
  readonly worlds?: RaceWorlds
  readonly emitters?: TrackEmitters
}

// The signals the projectiles' line probes started and stopped earlier in the frame (0x0041f730, in the power-ups'
// update, which runs after the worlds' animation and before the triggers).
export type SurfaceSignal = {
  readonly identifier: number
  readonly position: Vector3
}

export type TrackLogicStep = {
  readonly state: TrackLogicState
  readonly effects: readonly TrackEffect[]
}

// The operations the class handlers call; the session threads the state through them (events.ts).
export type TrackSession = HazardBus & {
  readonly context: TrackLogicContext
  // MOV r16,word ptr [position*2 + 0x004befec] after advancing the position.
  readonly drawRandomValue: () => number
  readonly drawScaledRange: (range: number) => number
  readonly emit: (effect: TrackEffect) => void
  // 0x0045edd0(event, from, to)
  readonly announceTransition: (event: TrackEvent, from: number, to: number) => void
  // The class's end (vtable +0xc).
  readonly endEvent: (event: TrackEvent) => TrackEvent
  // 0x00462350: the events with this identifier end at their next update.
  readonly forceEnd: (identifier: number) => void
  // 0x004628c0, 0x00462ae0 and 0x004629d0: a racer fires or releases the trigger-driven events.
  readonly fireTrigger: (identifier: number, racerIndex: number | null) => void
  readonly fireReleaseTrigger: (
    fireIdentifier: number,
    releaseIdentifier: number,
    racerIndex: number | null
  ) => void
  readonly releaseTrigger: (identifier: number, racerIndex: number | null) => void
  // The animation index (+0xbc) and flags (+0x5c) of the scene object (a skeleton instance of the track world, or of
  // the blended world) an event names, or null when the name is unknown.
  readonly getObject: (reference: ObjectReference) => TrackWorldObject | null
  // Where a bone of the scene object is in the world now (0x0045ebe0: the bone's chain of transforms, then the object's
  // frame), or null when the object or its skeleton is unknown.
  readonly getObjectBonePosition: (reference: ObjectReference, boneIndex: number) => Vector3 | null
  // 0x00489660 on the emitter a track event holds.
  readonly setEmitterPosition: (handle: EmitterReference, position: Vector3) => void
  // 0x00463570, 0x004635c0 and 0x004633f0 write the requested animation (+0xd8, the second clip) and the flag word
  // (+0x5c) of the scene object; the instance's next update starts the clip (0x10023b10).
  readonly requestObjectAnimation: (
    reference: ObjectReference,
    animation: number,
    flags: number
  ) => void
  // Events_Update 0x00461cc0
  readonly updateEvents: (milliseconds: number) => void
  // 0x00416090 for the three worlds (track, local, blended), the first of Race_Update's per-frame updates.
  readonly advanceWorlds: (milliseconds: number) => void
  // 0x0045eaf0's spawn: the emitter of this name from the common pool when it has one, else from the track's; null
  // when the race has none, nothing was free, or the emitter is a one-shot.
  readonly spawnEmitter: (name: string, placement: EmitterPlacement) => EmitterReference | null
  // 0x00489f30: the owner lets go of its emitter.
  readonly releaseEmitter: (handle: EmitterReference) => void
  // Emitters_Update 0x00489fa0 for the common pool and then the track's.
  readonly updateEmitters: (milliseconds: number) => void
  // Hazards_Update 0x0048add0 and the hazards' camera update 0x0048ae00 after the racers.
  readonly updateHazards: (milliseconds: number) => void
  readonly updateHazardsAfterRacers: (cameraPositions: readonly Vector3[]) => void
  // Timers_Update 0x00464dd0 and the registry's time list (0x0042fc10).
  readonly updateTimers: (milliseconds: number) => void
  // Triggers_Update: the environment triggers, then the main triggers, release what nobody touched.
  readonly updateTriggers: (racerCount: number) => void
  readonly touchTrigger: (contact: TrackTriggerContact) => void
  // The collision registry found a racer overlapping the sphere of the hazard at this index (vtable +0x00).
  readonly touchHazard: (hazardIndex: number, racerIndex: number) => void
  readonly tickTimeEntries: (milliseconds: number) => void
}

export type TrackEventHandlers = {
  readonly begin: (
    event: TrackEvent,
    session: TrackSession,
    parameter: Vector3 | null
  ) => TrackEvent
  readonly end: (event: TrackEvent, session: TrackSession) => TrackEvent
  readonly update: (event: TrackEvent, session: TrackSession, milliseconds: number) => TrackEvent
  // Classes 4D, 51, 55 and 59 react to racers instead (vtable slots 0 and 2).
  readonly fire: (event: TrackEvent, session: TrackSession, racerIndex: number | null) => TrackEvent
  readonly release: (
    event: TrackEvent,
    session: TrackSession,
    racerIndex: number | null
  ) => TrackEvent
}

export type RandomEvents = {
  readonly events: readonly TrackEvent[]
  readonly random: TrackRandom
}

export type AnimationView = {
  readonly reference: ObjectReference
  readonly object: TrackWorldObject
  // +0x24, +0x28, +0x2c and +0x30: the keywords 0x34, 0x35, 0x36 and 0x37.
  readonly first: number
  readonly second: number
  readonly third: number
  readonly fourth: number
}

export type TimerSetupProgress = {
  readonly state: TrackTimerState
  readonly position: RandomTablePosition
}

export type SessionBuild = {
  readonly session: TrackSession
  readonly finish: () => TrackLogicStep
}

export type SessionReference = { current: TrackSession | null }

// The hazards a race loaded, the worlds their loaders changed and the random table position after their draws.
export type LoadedHazards = Pick<TrackLogicState, 'hazards' | 'worlds'> & {
  readonly position: RandomTablePosition
}
