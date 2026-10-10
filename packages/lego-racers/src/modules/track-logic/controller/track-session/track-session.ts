import { drawRandomScaledRange, drawRandomValue } from '../../../random-table/index.ts'
import type { Vector3 } from '../../../event/index.ts'
import {
  EVENT_HELD_FLAG,
  EVENT_PULSE_FLAG,
  TrackEventKind,
  TrackEventState,
} from '../../types/track-event-state/track-event-state.ts'
import type {
  TrackEffect,
  TrackEvent,
  TrackLogicContext,
  TrackLogicState,
  TrackSession,
  SessionBuild,
  SessionReference,
} from '../../types/track-logic.types.ts'
import { getEventHandlers } from '../event-handlers/event-handler-table.ts'
import { tickTimeEntries, updateTimers } from '../timer-logic/timer-logic.ts'
import { touchTrigger, updateTriggers } from '../trigger-logic/trigger-logic.ts'

// The order of the arrays in Events_Update 0x00461cc0.
const UPDATE_ORDER: readonly string[] = [
  TrackEventKind.KIND_2A,
  TrackEventKind.KIND_28,
  TrackEventKind.KIND_29,
  TrackEventKind.KIND_3D,
  TrackEventKind.KIND_42,
  TrackEventKind.KIND_4B,
  TrackEventKind.KIND_52,
  TrackEventKind.KIND_4D,
  TrackEventKind.KIND_51,
  TrackEventKind.KIND_53,
  TrackEventKind.KIND_55,
  TrackEventKind.KIND_59,
]
// The order the three signal functions 0x00461ef0, 0x00462580 and 0x00462140 walk the arrays in.
const BUS_ORDER: readonly string[] = [
  TrackEventKind.KIND_2A,
  TrackEventKind.KIND_28,
  TrackEventKind.KIND_29,
  TrackEventKind.KIND_3D,
  TrackEventKind.KIND_42,
  TrackEventKind.KIND_4B,
  TrackEventKind.KIND_52,
  TrackEventKind.KIND_53,
]
// The order of the trigger-driven functions 0x004628c0, 0x00462ae0 and 0x004629d0.
const TRIGGER_ORDER: readonly string[] = [
  TrackEventKind.KIND_4D,
  TrackEventKind.KIND_51,
  TrackEventKind.KIND_55,
  TrackEventKind.KIND_59,
]
const ANNOUNCED_STATES: readonly number[] = Object.freeze([
  TrackEventState.FIRST_PHASE,
  TrackEventState.RUNNING,
  TrackEventState.LAST_PHASE,
])
const NO_PHASE = 3
const NO_IDENTIFIER = -1

const getIsBeginAllowed = (event: TrackEvent): boolean =>
  (event.flags & EVENT_PULSE_FLAG) === 0 &&
  (event.state === TrackEventState.INACTIVE || event.state === TrackEventState.LAST_PHASE)

const getPhaseIdentifier = (event: TrackEvent, phase: number): number => {
  const { first, second, third } = event.phaseSignals
  if (phase === 0) return first
  if (phase === 1) return second
  return phase === 2 ? third : NO_IDENTIFIER
}

// The state of one pass over the events, threaded through the handlers: the arrays are replaced event by event, as
// the original changes them in place while a signal is still walking them.
export const createTrackSession = (
  state: TrackLogicState,
  context: TrackLogicContext
): SessionBuild => {
  let events: Record<string, readonly TrackEvent[]> = { ...state.events }
  let position = state.random.position
  let timers = state.timers
  let triggers = state.triggers
  const effects: TrackEffect[] = []

  const getEvents = (kind: string): readonly TrackEvent[] => events[kind] ?? []

  const setEvent = (kind: string, index: number, event: TrackEvent): void => {
    events = {
      ...events,
      [kind]: getEvents(kind).map((current, currentIndex) =>
        currentIndex === index ? event : current
      ),
    }
  }

  // Runs a handler on the event at an index and stores the result at that index.
  const apply = (kind: string, index: number, run: (event: TrackEvent) => TrackEvent): void => {
    const event = getEvents(kind)[index]
    if (event !== undefined) setEvent(kind, index, run(event))
  }

  const forEach = (kinds: readonly string[], visit: (kind: string, index: number) => void): void =>
    kinds.forEach((kind) => {
      for (let index = 0; index < getEvents(kind).length; index += 1) visit(kind, index)
    })

  const sessionRef: SessionReference = { current: null }
  const getSession = (): TrackSession => {
    if (sessionRef.current === null) throw new Error('The track session is not ready')
    return sessionRef.current
  }

  // 0x0045ee50
  const beginIfAllowed = (kind: string, index: number, parameter: Vector3 | null): void =>
    apply(kind, index, (event) =>
      getIsBeginAllowed(event)
        ? getEventHandlers(kind).begin(event, getSession(), parameter)
        : event
    )

  // 0x0045ee70 and 0x0045eee0: end (release) a running event; a pulse that is not running begins (fires) and ends.
  const stopIfAllowed = (
    kind: string,
    index: number,
    start: (event: TrackEvent) => TrackEvent,
    stop: (event: TrackEvent) => TrackEvent
  ): void =>
    apply(kind, index, (event) => {
      const isPulse =
        (event.flags & EVENT_PULSE_FLAG) !== 0 &&
        (event.state === TrackEventState.INACTIVE || event.state === TrackEventState.LAST_PHASE)
      if (!isPulse) {
        return event.state !== TrackEventState.INACTIVE && (event.flags & EVENT_HELD_FLAG) === 0
          ? stop(event)
          : event
      }
      const started = start(event)
      return (event.flags & EVENT_HELD_FLAG) === 0 ? stop(started) : started
    })

  const endIfAllowed = (kind: string, index: number, parameter: Vector3 | null): void =>
    stopIfAllowed(
      kind,
      index,
      (event) => getEventHandlers(kind).begin(event, getSession(), parameter),
      (event) => getEventHandlers(kind).end(event, getSession())
    )

  // 0x0045eec0 and 0x0045eee0: the same two for the classes that react to racers.
  const fireIfAllowed = (kind: string, index: number, racerIndex: number | null): void =>
    apply(kind, index, (event) =>
      getIsBeginAllowed(event)
        ? getEventHandlers(kind).fire(event, getSession(), racerIndex)
        : event
    )

  const releaseIfAllowed = (kind: string, index: number, racerIndex: number | null): void =>
    stopIfAllowed(
      kind,
      index,
      (event) => getEventHandlers(kind).fire(event, getSession(), racerIndex),
      (event) => getEventHandlers(kind).release(event, getSession(), racerIndex)
    )

  const setSignalHeld = (kind: string, index: number, isHeld: boolean): void =>
    apply(kind, index, (event) => ({ ...event, isSignalHeld: isHeld }))

  const getHoldIdentifier = (event: TrackEvent): number => {
    if (event.kind === TrackEventKind.KIND_4B) return event.record.keyword4cInteger
    return event.kind === TrackEventKind.KIND_59 ? event.record.keyword4cInteger : NO_IDENTIFIER
  }

  const forceEnd = (identifier: number): void =>
    forEach(UPDATE_ORDER, (kind, index) =>
      apply(kind, index, (event) =>
        event.identifier === identifier ? { ...event, state: TrackEventState.END_REQUESTED } : event
      )
    )

  const startSignal = (identifier: number, parameter: Vector3 | null): void => {
    forEach(BUS_ORDER, (kind, index) => {
      if (getEvents(kind)[index]?.identifier === identifier) beginIfAllowed(kind, index, parameter)
      if (kind === TrackEventKind.KIND_4B) {
        const event = getEvents(kind)[index]
        if (event !== undefined && getHoldIdentifier(event) === identifier) {
          setSignalHeld(kind, index, true)
        }
      }
    })
    state.links.forEach((link) => {
      if (link.identifier === identifier) forceEnd(link.linkedIdentifier)
    })
    forEach([TrackEventKind.KIND_59], (kind, index) => {
      const event = getEvents(kind)[index]
      if (event !== undefined && getHoldIdentifier(event) === identifier) {
        setSignalHeld(kind, index, true)
      }
    })
  }

  const startStopSignal = (
    startIdentifier: number,
    stopIdentifier: number,
    parameter: Vector3 | null
  ): void => {
    forEach(BUS_ORDER, (kind, index) => {
      if (getEvents(kind)[index]?.identifier === startIdentifier) {
        beginIfAllowed(kind, index, parameter)
      }
      if (kind === TrackEventKind.KIND_4B) {
        const held = getEvents(kind)[index]
        if (held !== undefined && getHoldIdentifier(held) === startIdentifier) {
          setSignalHeld(kind, index, true)
        }
      }
      if (getEvents(kind)[index]?.identifier === stopIdentifier) {
        endIfAllowed(kind, index, parameter)
      }
      if (kind === TrackEventKind.KIND_4B) {
        const held = getEvents(kind)[index]
        if (held !== undefined && getHoldIdentifier(held) === stopIdentifier) {
          setSignalHeld(kind, index, false)
        }
      }
    })
    state.links.forEach((link) => {
      if (link.identifier === startIdentifier) forceEnd(link.linkedIdentifier)
    })
    forEach([TrackEventKind.KIND_59], (kind, index) => {
      const event = getEvents(kind)[index]
      if (event !== undefined && getHoldIdentifier(event) === startIdentifier) {
        setSignalHeld(kind, index, true)
      }
      const after = getEvents(kind)[index]
      if (after !== undefined && getHoldIdentifier(after) === stopIdentifier) {
        setSignalHeld(kind, index, false)
      }
    })
  }

  const stopSignal = (identifier: number, parameter: Vector3 | null): void => {
    forEach(BUS_ORDER, (kind, index) => {
      if (getEvents(kind)[index]?.identifier === identifier) endIfAllowed(kind, index, parameter)
      if (kind === TrackEventKind.KIND_4B) {
        const event = getEvents(kind)[index]
        if (event !== undefined && getHoldIdentifier(event) === identifier) {
          setSignalHeld(kind, index, false)
        }
      }
    })
    forEach([TrackEventKind.KIND_59], (kind, index) => {
      const event = getEvents(kind)[index]
      if (event !== undefined && getHoldIdentifier(event) === identifier) {
        setSignalHeld(kind, index, false)
      }
    })
  }

  const announceTransition = (event: TrackEvent, from: number, to: number): void => {
    const fromIndex = ANNOUNCED_STATES.indexOf(from)
    const fromIdentifier = fromIndex === -1 ? NO_IDENTIFIER : getPhaseIdentifier(event, fromIndex)
    const toIdentifier = to === NO_PHASE ? NO_IDENTIFIER : getPhaseIdentifier(event, to)
    if (fromIdentifier !== NO_IDENTIFIER) {
      if (toIdentifier !== NO_IDENTIFIER) startStopSignal(toIdentifier, fromIdentifier, null)
      else stopSignal(fromIdentifier, null)
    } else if (toIdentifier !== NO_IDENTIFIER) startSignal(toIdentifier, null)
  }

  // 0x004628c0: a trigger fired the events that carry its identifier.
  const fireTrigger = (identifier: number, racerIndex: number | null): void =>
    forEach(TRIGGER_ORDER, (kind, index) => {
      if (getEvents(kind)[index]?.identifier === identifier) {
        fireIfAllowed(kind, index, racerIndex)
      }
    })

  // 0x00462ae0: a surface starts one identifier and stops another for a racer.
  const fireReleaseTrigger = (
    fireIdentifier: number,
    releaseIdentifier: number,
    racerIndex: number | null
  ): void =>
    forEach(TRIGGER_ORDER, (kind, index) => {
      if (getEvents(kind)[index]?.identifier === fireIdentifier) {
        fireIfAllowed(kind, index, racerIndex)
      }
      if (getEvents(kind)[index]?.identifier === releaseIdentifier) {
        releaseIfAllowed(kind, index, racerIndex)
      }
    })

  // 0x004629d0: a racer left what it was touching.
  const releaseTrigger = (identifier: number, racerIndex: number | null): void =>
    forEach(TRIGGER_ORDER, (kind, index) => {
      if (getEvents(kind)[index]?.identifier === identifier) {
        releaseIfAllowed(kind, index, racerIndex)
      }
    })

  // Events_Update 0x00461cc0.
  const updateEvents = (milliseconds: number): void =>
    forEach(UPDATE_ORDER, (kind, index) =>
      apply(kind, index, (event) =>
        getEventHandlers(kind).update(event, getSession(), milliseconds)
      )
    )

  const session: TrackSession = {
    context,
    drawRandomValue: () => {
      const draw = drawRandomValue(state.random.table, position)
      position = draw.position
      return draw.value
    },
    drawScaledRange: (range) => {
      const draw = drawRandomScaledRange(state.random.table, position, range)
      position = draw.position
      return draw.value
    },
    emit: (effect) => void effects.push(effect),
    announceTransition,
    endEvent: (event) => getEventHandlers(event.kind).end(event, getSession()),
    startSignal,
    startStopSignal,
    stopSignal,
    forceEnd,
    fireTrigger,
    fireReleaseTrigger,
    releaseTrigger,
    updateEvents,
    updateTimers: (milliseconds) => {
      timers = updateTimers(timers, session, milliseconds)
    },
    updateTriggers: (racerCount) => {
      triggers = updateTriggers(triggers, session, racerCount)
    },
    touchTrigger: (contact) => {
      triggers = touchTrigger(triggers, contact, session)
    },
    tickTimeEntries: (milliseconds) => {
      timers = tickTimeEntries(timers, session, milliseconds)
    },
  }
  sessionRef.current = session

  return {
    session,
    finish: () =>
      Object.freeze({
        state: Object.freeze({
          ...state,
          events: Object.freeze(events),
          timers,
          triggers,
          random: Object.freeze({ table: state.random.table, position }),
        }),
        effects: Object.freeze([...effects]),
      }),
  }
}
