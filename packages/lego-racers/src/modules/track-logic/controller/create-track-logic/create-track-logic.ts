import type {
  Event2A,
  EventBlockHeader,
  EventPhaseSignals,
  EventSet,
} from '../../../event/index.ts'
import { NO_SIGNAL } from '../../../event/index.ts'
import { createHazardRuntime, EMPTY_HAZARD_RUNTIME } from '../../../hazard/index.ts'
import type { HazardSession } from '../../../hazard/index.ts'
import { drawRandomValue } from '../../../random-table/index.ts'
import { NO_EMITTER_POOLS } from '../../../emitter/index.ts'
import {
  EMPTY_WORLD_ANIMATION,
  findSkeletonInstanceIndex,
  getSkeletonInstanceFlags,
  getSkeletonInstanceWithFlags,
  getWorldWithSkeletonInstance,
} from '../../../world-animation/index.ts'
import type { RaceWorlds } from '../../../world-animation/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { getTruncatedInteger } from '../../../simulation-math/index.ts'
import { TrackEventKind, TrackEventState } from '../../types/track-event-state/track-event-state.ts'
import type {
  TrackEvent,
  TrackEventBase,
  LoadedHazards,
  TrackEventSet,
  TrackLogicInput,
  TrackLogicState,
  TrackRandom,
  RandomEvents,
} from '../../types/track-logic.types.ts'
import { createTimers } from '../timer-logic/timer-logic.ts'
import { createTriggers } from '../trigger-logic/trigger-logic.ts'
import {
  RANDOM_SOUND_MINIMUM_PERIOD,
  RANDOM_SOUND_PERIOD,
} from '../event-handlers/bus-event-handlers.ts'

const BYTE_MASK = 0xff
// 0x004b09c0
const CHANCE_SCALE = 255
const ORIGIN = Object.freeze([0, 0, 0] as const)
const NO_PHASE_SIGNALS: EventPhaseSignals = Object.freeze({
  first: NO_SIGNAL,
  second: NO_SIGNAL,
  third: NO_SIGNAL,
})
const EMPTY_EVENTS: TrackEventSet = Object.freeze({
  [TrackEventKind.KIND_2A]: Object.freeze([]),
  [TrackEventKind.KIND_28]: Object.freeze([]),
  [TrackEventKind.KIND_29]: Object.freeze([]),
  [TrackEventKind.KIND_3D]: Object.freeze([]),
  [TrackEventKind.KIND_42]: Object.freeze([]),
  [TrackEventKind.KIND_4B]: Object.freeze([]),
  [TrackEventKind.KIND_52]: Object.freeze([]),
  [TrackEventKind.KIND_53]: Object.freeze([]),
  [TrackEventKind.KIND_59]: Object.freeze([]),
  [TrackEventKind.KIND_4D]: Object.freeze([]),
  [TrackEventKind.KIND_51]: Object.freeze([]),
  [TrackEventKind.KIND_55]: Object.freeze([]),
})

const getFlags = (...flags: readonly (readonly [boolean, number])[]): number =>
  flags.reduce((combined, [isSet, bit]) => (isSet ? combined | bit : combined), 0)

const createEvent = <Kind extends TrackEvent['kind'], Record extends EventBlockHeader>(
  kind: Kind,
  record: Record,
  phaseSignals: EventPhaseSignals,
  state: number,
  flags: number
): TrackEventBase<Kind, Record> => ({
  kind,
  record,
  identifier: record.identifier,
  state,
  flags,
  phaseSignals,
  timerMilliseconds: 0,
  position: ORIGIN,
  chance: BYTE_MASK,
  isHandleHeld: false,
  emitterHandle: null,
  isSignalHeld: false,
})

// 0x004641b0: a 2A event takes one draw (500..1499 ms) for its timer while Events_Load reads it.
const createRandomSoundEvents = (
  records: readonly Event2A[],
  arithmetic: FloatArithmetic,
  random: TrackRandom
): RandomEvents =>
  records.reduce<RandomEvents>(
    (made, record) => {
      const draw = drawRandomValue(made.random.table, made.random.position)
      const event = createEvent(
        TrackEventKind.KIND_2A,
        record,
        NO_PHASE_SIGNALS,
        TrackEventState.INACTIVE,
        getFlags(
          [record.isKeyword2dSet, 1],
          [record.isKeyword3aSet, 2],
          [record.isBraced, 4],
          [record.isKeyword3fSet, 8]
        )
      )
      return {
        events: [
          ...made.events,
          {
            ...event,
            position: record.position,
            chance:
              getTruncatedInteger(arithmetic.multiply(record.chance, CHANCE_SCALE)) & BYTE_MASK,
            timerMilliseconds: (draw.value % RANDOM_SOUND_PERIOD) + RANDOM_SOUND_MINIMUM_PERIOD,
          },
        ],
        random: { table: made.random.table, position: draw.position },
      }
    },
    { events: [], random }
  )

// Events_Load 0x0045efa0 and the object initialisers of its section readers: the classes' first state and flags
// (event +0x18, +0x1c). The only draws are the 2A events' timers, in file order.
const createEventState = (
  eventSet: EventSet | null,
  arithmetic: FloatArithmetic,
  random: TrackRandom
): Pick<TrackLogicState, 'events' | 'links' | 'random'> => {
  if (eventSet === null) return Object.freeze({ events: EMPTY_EVENTS, links: [], random })
  const soundEvents = createRandomSoundEvents(eventSet.events2A, arithmetic, random)
  const events: TrackEventSet = Object.freeze({
    [TrackEventKind.KIND_2A]: Object.freeze(soundEvents.events),
    [TrackEventKind.KIND_28]: Object.freeze(
      eventSet.events28.map((record) =>
        createEvent(
          TrackEventKind.KIND_28,
          record,
          record.phaseSignals,
          TrackEventState.INACTIVE,
          getFlags(
            [record.isKeyword2dSet, 1],
            [record.isKeyword3aSet, 2],
            [record.isBraced, 4],
            [record.isKeyword3fSet, 8],
            [record.isKeyword41Set, 0x10]
          )
        )
      )
    ),
    [TrackEventKind.KIND_29]: Object.freeze(
      eventSet.events29.map((record) =>
        createEvent(
          TrackEventKind.KIND_29,
          record,
          record.phaseSignals,
          TrackEventState.INACTIVE,
          getFlags(
            [record.isKeyword2dSet, 1],
            [record.isKeyword3aSet, 2],
            [record.isBraced, 4],
            [record.isKeyword3fSet, 8]
          )
        )
      )
    ),
    [TrackEventKind.KIND_3D]: Object.freeze(
      eventSet.events3D.map((record) => ({
        ...createEvent(
          TrackEventKind.KIND_3D,
          record,
          record.phaseSignals,
          TrackEventState.INACTIVE,
          getFlags([record.isKeyword3aSet, 2], [record.isBraced, 4], [record.isKeyword3fSet, 8])
        ),
        position: record.position,
      }))
    ),
    [TrackEventKind.KIND_42]: Object.freeze(
      eventSet.events42.map((record) =>
        createEvent(
          TrackEventKind.KIND_42,
          record,
          record.phaseSignals,
          TrackEventState.INACTIVE,
          getFlags([record.isBraced, 4])
        )
      )
    ),
    [TrackEventKind.KIND_4B]: Object.freeze(
      eventSet.events4B.map((record) =>
        createEvent(
          TrackEventKind.KIND_4B,
          record,
          record.phaseSignals,
          TrackEventState.LAST_PHASE,
          getFlags([record.isBraced, 4])
        )
      )
    ),
    [TrackEventKind.KIND_52]: Object.freeze(
      eventSet.events52.map((record) =>
        createEvent(
          TrackEventKind.KIND_52,
          record,
          record.phaseSignals,
          TrackEventState.INACTIVE,
          getFlags([record.isBraced, 4])
        )
      )
    ),
    [TrackEventKind.KIND_53]: Object.freeze(
      eventSet.events53.map((record) =>
        createEvent(
          TrackEventKind.KIND_53,
          record,
          record.phaseSignals,
          TrackEventState.INACTIVE,
          getFlags([record.isKeyword3aSet, 2], [record.isBraced, 4])
        )
      )
    ),
    [TrackEventKind.KIND_59]: Object.freeze(
      eventSet.events59.map((record) =>
        createEvent(
          TrackEventKind.KIND_59,
          record,
          record.phaseSignals,
          TrackEventState.INACTIVE,
          getFlags([record.isBraced, 4])
        )
      )
    ),
    [TrackEventKind.KIND_4D]: Object.freeze(
      eventSet.events4D.map((record) =>
        createEvent(
          TrackEventKind.KIND_4D,
          record,
          record.phaseSignals,
          TrackEventState.LAST_PHASE,
          getFlags([record.isBraced, 4], [record.isBraced || record.isKeyword3aSet, 2])
        )
      )
    ),
    [TrackEventKind.KIND_51]: Object.freeze(
      eventSet.events51.map((record) =>
        createEvent(
          TrackEventKind.KIND_51,
          record,
          record.phaseSignals,
          TrackEventState.LAST_PHASE,
          0
        )
      )
    ),
    [TrackEventKind.KIND_55]: Object.freeze(
      eventSet.events55.map((record) =>
        createEvent(
          TrackEventKind.KIND_55,
          record,
          record.phaseSignals,
          TrackEventState.LAST_PHASE,
          0
        )
      )
    ),
  })
  return Object.freeze({ events, links: eventSet.links, random: soundEvents.random })
}

const EMPTY_WORLDS: RaceWorlds = Object.freeze({
  track: EMPTY_WORLD_ANIMATION,
  blended: EMPTY_WORLD_ANIMATION,
  local: EMPTY_WORLD_ANIMATION,
})

// Hazards_Load 0x0048a4d0: the loaders may change the worlds and draw (class 0x2d begins as it loads). Their
// signals and effects have nobody to hear them yet.
const createHazards = (
  input: TrackLogicInput,
  arithmetic: FloatArithmetic,
  random: TrackRandom
): LoadedHazards => {
  let worlds = input.worlds ?? EMPTY_WORLDS
  let position = random.position
  const session: HazardSession = {
    arithmetic,
    drawRandomValue: () => {
      const draw = drawRandomValue(random.table, position)
      position = draw.position
      return draw.value
    },
    startSignal: () => undefined,
    startStopSignal: () => undefined,
    stopSignal: () => undefined,
    getWorld: (key) => worlds[key],
    setWorld: (key, world) => {
      worlds = { ...worlds, [key]: world }
    },
    getEmitters: () => input.emitters?.track ?? null,
    setEmitters: () => undefined,
    getRacer: () => null,
    getTableCosine: () => 1,
    probe: () => null,
    emit: () => undefined,
  }
  const hazards =
    input.hazardList === undefined || input.hazardList === null
      ? EMPTY_HAZARD_RUNTIME
      : createHazardRuntime(input.hazardList, { isMirrored: input.isMirrored ?? false, session })
  return { hazards, worlds: Object.freeze(worlds), position }
}

// The 28 events' initialiser 0x00463330 ORs 0x200000 into the flags (+0x5c) of the scene object the event drives.
const EVENT_DRIVEN_FLAG = 0x200000

const getWorldsWithEventObjects = (
  worlds: RaceWorlds,
  eventSet: EventSet | null
): RaceWorlds =>
  (eventSet?.events28 ?? []).reduce((current, record) => {
    const reference = record.objectReference
    if (reference === null) return current
    const key = reference.isFromSecondWorld ? 'blended' : 'track'
    const world = current[key]
    const index = findSkeletonInstanceIndex(world, reference.name)
    const instance = world.skeletonInstances[index]
    if (instance === undefined) return current
    return Object.freeze({
      ...current,
      [key]: getWorldWithSkeletonInstance(
        world,
        index,
        getSkeletonInstanceWithFlags(
          instance,
          (getSkeletonInstanceFlags(instance) | EVENT_DRIVEN_FLAG) >>> 0
        )
      ),
    })
  }, worlds)

// Race_LoadTrackContent 0x00433480 after the racers: Events_Load (the 2A events' draws), Hazards_Load, then
// Timers_Load (the marked second values' draws). Triggers and emitters draw nothing while they load.
export const createTrackLogic = (
  input: TrackLogicInput,
  arithmetic: FloatArithmetic,
  random: TrackRandom
): TrackLogicState => {
  const { eventSet, timerList, mainTriggers, environmentTriggers } = input
  const events = createEventState(eventSet, arithmetic, random)
  const loadedHazards = createHazards(input, arithmetic, {
    table: random.table,
    position: events.random.position,
  })
  const timers = createTimers(timerList, random.table, loadedHazards.position)
  return Object.freeze({
    ...events,
    timers: timers.state,
    worlds: getWorldsWithEventObjects(loadedHazards.worlds, eventSet),
    hazards: loadedHazards.hazards,
    emitters: input.emitters ?? NO_EMITTER_POOLS,
    triggers: createTriggers(mainTriggers, environmentTriggers),
    random: Object.freeze({ table: random.table, position: timers.position }),
  })
}
