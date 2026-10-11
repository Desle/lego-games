import { TrackEventState } from '../../types/track-event-state/track-event-state.ts'
import type {
  TrackEvent,
  TrackEventAction,
  TrackEventHandlers,
  TrackSession,
} from '../../types/track-logic.types.ts'

export const getWithState = <Event extends TrackEvent>(event: Event, state: number): Event => ({
  ...event,
  state,
})

// 0x0045edc0: the base of every class's update.
export const endIfRequested = (event: TrackEvent, session: TrackSession): TrackEvent =>
  event.state === TrackEventState.END_REQUESTED ? session.endEvent(event) : event

export const emitAction = (
  session: TrackSession,
  event: TrackEvent,
  action: TrackEventAction
): void =>
  session.emit({
    type: 'track.event_action',
    kind: event.kind,
    identifier: event.identifier,
    action,
  })

// 0x0045edd0 from the given state to the given phase, then the new state: what most begin and end functions end on.
export const announceAndSet = (
  session: TrackSession,
  event: TrackEvent,
  from: number,
  to: number,
  state: number
): TrackEvent => {
  session.announceTransition(event, from, to)
  return getWithState(event, state)
}

const returnEvent = (event: TrackEvent): TrackEvent => event

// The classes' vtable slots that do nothing (0x004513d0, 0x004164c0) around the base update.
export const IDLE_HANDLERS: TrackEventHandlers = Object.freeze({
  begin: returnEvent,
  end: returnEvent,
  update: endIfRequested,
  fire: returnEvent,
  release: returnEvent,
})
