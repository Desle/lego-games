import { TrackEventKind, TrackEventState } from '../../types/track-event-state/track-event-state.ts'
import type { TrackEventHandlers } from '../../types/track-logic.types.ts'
import { announceAndSet, emitAction, IDLE_HANDLERS } from './event-handler-helpers.ts'

const FIRST_SIGNAL = 1
const NO_SIGNAL_PHASE = 3
// 0x00462fe0 and 0x00463040: the car body's force slots, picked by the block's keyword 0x5a.
const FIRST_FORCE_SLOT = 0x40
const SECOND_FORCE_SLOT = 0x48
const FORCE_RELEASE_OFFSET = 4

// The classes below react to racers instead of the bus: their begin and end (vtable slots 1 and 3) do nothing, and a
// trigger or a surface fires them through 0x004628c0 and 0x00462ae0 (slot 0) and releases them (slot 2).
const releaseToLastPhase: TrackEventHandlers['release'] = (event, session) =>
  announceAndSet(session, event, event.state, NO_SIGNAL_PHASE, TrackEventState.LAST_PHASE)

const NO_BIASES = Object.freeze([0, 0, 0, 0] as const)

// 0x00465600 (fire) and 0x00465690 (release), for an event that names no object: the racer's vehicle gets the colour
// shift of the block's keywords 0x4e and 0x4f (0x004400a0) and loses it on release (0x004400e0). A block with keyword 0x50
// does the opposite: its fire ends the shift and its release does nothing. A block that names an object shifts that
// object instead (not ported: no traced track has one).
export const HANDLERS_4D: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  fire: (event, session, racerIndex) => {
    emitAction(session, event, 'fire')
    if (
      event.kind === TrackEventKind.KIND_4D &&
      racerIndex !== null &&
      event.record.objectName === null
    ) {
      session.emit({
        type: 'track.racer_colour_shift_changed',
        racerIndex,
        shifts: event.record.isKeyword50Set ? null : event.record.keyword4eIntegers,
        biases: event.record.isKeyword50Set ? NO_BIASES : event.record.keyword4fIntegers,
      })
    }
    return announceAndSet(session, event, TrackEventState.INACTIVE, FIRST_SIGNAL, event.state)
  },
  release: (event, session, racerIndex) => {
    emitAction(session, event, 'release')
    if (
      event.kind === TrackEventKind.KIND_4D &&
      racerIndex !== null &&
      event.record.objectName === null &&
      !event.record.isKeyword50Set
    ) {
      session.emit({
        type: 'track.racer_colour_shift_changed',
        racerIndex,
        shifts: null,
        biases: NO_BIASES,
      })
    }
    return releaseToLastPhase(event, session, racerIndex)
  },
})

// 0x00464680, 0x004646e0: puts the racer in the zone the block names (0x00439b70, 0x00439ba0, 0x00439c40).
export const HANDLERS_51: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  fire: (event, session, racerIndex) => {
    if (event.kind !== TrackEventKind.KIND_51) return event
    if (racerIndex !== null) {
      session.emit({
        type: 'track.racer_zone_entered',
        racerIndex,
        zone: event.record.zone,
      })
    }
    return announceAndSet(session, event, TrackEventState.INACTIVE, FIRST_SIGNAL, event.state)
  },
  release: releaseToLastPhase,
})

// 0x0045e6c0, 0x0045e6f0: sets and clears the racer's guidance target (0x00439e60, 0x00439e90).
export const HANDLERS_55: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  fire: (event, session, racerIndex) => {
    if (event.kind !== TrackEventKind.KIND_55) return event
    const announced = announceAndSet(
      session,
      event,
      TrackEventState.INACTIVE,
      FIRST_SIGNAL,
      event.state
    )
    if (racerIndex !== null) {
      session.emit({
        type: 'track.racer_target_set',
        racerIndex,
        target: event.record.position,
      })
    }
    return announced
  },
  release: (event, session, racerIndex) => {
    const released = releaseToLastPhase(event, session, racerIndex)
    if (racerIndex !== null) {
      session.emit({ type: 'track.racer_target_set', racerIndex, target: null })
    }
    return released
  },
})

// 0x00462fe0, 0x00463040: a force on the racer's car body while the block's held signal is on.
export const HANDLERS_59: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  fire: (event, session, racerIndex) => {
    if (event.kind !== TrackEventKind.KIND_59 || !event.isSignalHeld) return event
    if (racerIndex !== null) {
      const slot = event.record.keyword5aInteger === 0 ? FIRST_FORCE_SLOT : SECOND_FORCE_SLOT
      if (event.record.keyword5aInteger === 0 || event.record.keyword5aInteger === 1) {
        session.emit({
          type: 'track.racer_force_changed',
          racerIndex,
          slot,
          vector: event.record.position,
        })
      }
    }
    return announceAndSet(
      session,
      event,
      TrackEventState.INACTIVE,
      FIRST_SIGNAL,
      TrackEventState.RUNNING
    )
  },
  release: (event, session, racerIndex) => {
    if (event.kind !== TrackEventKind.KIND_59) return event
    if (
      racerIndex !== null &&
      (event.record.keyword5aInteger === 0 || event.record.keyword5aInteger === 1)
    ) {
      session.emit({
        type: 'track.racer_force_changed',
        racerIndex,
        slot:
          (event.record.keyword5aInteger === 0 ? FIRST_FORCE_SLOT : SECOND_FORCE_SLOT) +
          FORCE_RELEASE_OFFSET,
        vector: null,
      })
    }
    return announceAndSet(session, event, event.state, NO_SIGNAL_PHASE, TrackEventState.INACTIVE)
  },
})
