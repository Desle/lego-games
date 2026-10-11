import type { ObjectReference } from '../../../event/index.ts'
import { TrackEventKind, TrackEventState } from '../../types/track-event-state/track-event-state.ts'
import type {
  TrackEvent,
  TrackEventHandlers,
  TrackSession,
  TrackWorldObject,
  AnimationView,
} from '../../types/track-logic.types.ts'
import {
  announceAndSet,
  endIfRequested,
  getWithState,
  IDLE_HANDLERS,
} from './event-handler-helpers.ts'

// Object +0x5c bits 0x00463570 and 0x004633f0 write with a requested animation (+0xd8).
const REQUEST_KEEP_MASK = 0xffb1ffff
const REQUEST_FLAGS = 0x100000
const RESTART_KEEP_MASK = 0xfff1ffff
const RESTART_FLAGS = 0x500000
// Object +0x5c bits that mean the previous request has not been taken yet.
const PENDING_MASK = 0x120000
const NO_ANIMATION = -1
const SHORT_MASK = 0xffff
const HELD_ANIMATION_FLAG = 1

// The phases an animation event passes through, in the order 0x004633f0 tests them at its end: the animation that
// puts the event in each state, the signal slot it announces and the state itself.
const PHASE_STATES = Object.freeze([
  Object.freeze({ slot: 0, state: TrackEventState.FIRST_PHASE }),
  Object.freeze({ slot: 1, state: TrackEventState.RUNNING }),
  Object.freeze({ slot: 2, state: TrackEventState.LAST_PHASE }),
  Object.freeze({ slot: 3, state: TrackEventState.INACTIVE }),
])

// What the event does to the scene object: which animation to ask for and how to set the flags.
const requestAnimation = (
  session: TrackSession,
  reference: ObjectReference,
  object: TrackWorldObject,
  animation: number,
  keepMask: number,
  setFlags: number
): void => {
  const flags = ((object.flags & keepMask) | setFlags) >>> 0
  session.requestObjectAnimation(reference, animation & SHORT_MASK, flags)
  session.emit({
    type: 'track.object_animation_requested',
    reference,
    requestedAnimation: animation & SHORT_MASK,
    flags,
  })
}

const getAnimationView = (event: TrackEvent, session: TrackSession): AnimationView | null => {
  if (event.kind !== TrackEventKind.KIND_28) return null
  const { record } = event
  const reference = record.objectReference
  if (reference === null) return null
  const object = session.getObject(reference)
  if (object === null) return null
  return {
    reference,
    object,
    first: record.keyword34Integer,
    second: record.keyword35Integer,
    third: record.keyword36Integer,
    fourth: record.keyword37Integer,
  }
}

// The request 0x004633f0 makes when the animation of the current state has been reached.
const requestForState = (event: TrackEvent, view: AnimationView, session: TrackSession): void => {
  const { reference, object, first, second, third, fourth } = view
  const animation = object.animationIndex
  const isPending = (object.flags & PENDING_MASK) !== 0
  if (isPending) return
  if (event.state === TrackEventState.FIRST_PHASE && animation === third) {
    const setFlags = (event.flags & HELD_ANIMATION_FLAG) === 0 ? REQUEST_FLAGS : RESTART_FLAGS
    requestAnimation(session, reference, object, first, REQUEST_KEEP_MASK, setFlags)
  } else if (event.state === TrackEventState.LAST_PHASE && animation === fourth) {
    requestAnimation(session, reference, object, second, RESTART_KEEP_MASK, RESTART_FLAGS)
  } else if (
    event.state === TrackEventState.RUNNING &&
    (event.flags & HELD_ANIMATION_FLAG) === 0 &&
    animation === first
  ) {
    if (fourth === NO_ANIMATION) {
      requestAnimation(session, reference, object, second, RESTART_KEEP_MASK, RESTART_FLAGS)
    } else {
      requestAnimation(session, reference, object, fourth, REQUEST_KEEP_MASK, REQUEST_FLAGS)
    }
  }
}

// 0x00463570 (begin), 0x004635c0 (end), 0x004633f0 (update): an animation of a scene object driven through its
// states by the animation index the world reports; begin only asks for the first animation.
export const HANDLERS_28: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  begin: (event, session) => {
    const view = getAnimationView(event, session)
    if (view === null) return event
    if (view.third !== NO_ANIMATION) {
      requestAnimation(
        session,
        view.reference,
        view.object,
        view.third,
        REQUEST_KEEP_MASK,
        REQUEST_FLAGS
      )
    } else {
      requestAnimation(
        session,
        view.reference,
        view.object,
        view.first,
        RESTART_KEEP_MASK,
        RESTART_FLAGS
      )
    }
    return event
  },
  end: (event, session) => {
    const view = getAnimationView(event, session)
    if (view === null || event.state === TrackEventState.INACTIVE) {
      return getWithState(event, TrackEventState.INACTIVE)
    }
    const { reference, object, second, fourth } = view
    if (object.animationIndex === second || object.animationIndex === fourth) {
      return getWithState(event, TrackEventState.INACTIVE)
    }
    if (fourth !== NO_ANIMATION) {
      requestAnimation(session, reference, object, fourth, REQUEST_KEEP_MASK, REQUEST_FLAGS)
    } else {
      requestAnimation(session, reference, object, second, RESTART_KEEP_MASK, RESTART_FLAGS)
    }
    return getWithState(event, TrackEventState.INACTIVE)
  },
  update: (event, session) => {
    const base = endIfRequested(event, session)
    const view = getAnimationView(base, session)
    if (view === null) return base
    requestForState(base, view, session)
    const animations = [view.third, view.first, view.fourth, view.second]
    const phaseIndex = PHASE_STATES.findIndex(
      (phase, index) =>
        animations[index] === view.object.animationIndex && base.state !== phase.state
    )
    const phase = PHASE_STATES[phaseIndex]
    if (phase === undefined) return base
    return announceAndSet(session, base, base.state, phase.slot, phase.state)
  },
})
