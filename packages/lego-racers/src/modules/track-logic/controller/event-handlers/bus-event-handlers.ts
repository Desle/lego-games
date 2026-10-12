import type { EmitterReference } from '../../../emitter/index.ts'
import { TrackEventKind, TrackEventState } from '../../types/track-event-state/track-event-state.ts'
import type { TrackEvent, TrackEventHandlers, TrackSession } from '../../types/track-logic.types.ts'
import {
  announceAndSet,
  emitAction,
  endIfRequested,
  getWithState,
  IDLE_HANDLERS,
} from './event-handler-helpers.ts'

// 0x004b09c0: the 2A chance (a float 0..1) times 255 is truncated to a byte; 255 plays on every begin.
export const ALWAYS_CHANCE = 255
export const RANDOM_SOUND_PERIOD = 1000
export const RANDOM_SOUND_MINIMUM_PERIOD = 500
const RANDOM_SOUND_CHANCE_RANGE = 255
const POSITION_FROM_SIGNAL_FLAG = 8
const LOOPED_SOUND_FLAG = 1
const FIRST_SIGNAL = 1
const NO_SIGNAL_PHASE = 3

// 0x004642c0 (begin), 0x004643b0 (end), 0x004643e0 (update): the random ambient sound. The object it follows
// (event +0x28, 0x004644b0) is not ported.
export const HANDLERS_2A: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  begin: (event, session, parameter) => {
    if (event.kind !== TrackEventKind.KIND_2A) return event
    const positioned =
      parameter !== null && (event.flags & POSITION_FROM_SIGNAL_FLAG) !== 0
        ? { ...event, position: parameter }
        : event
    if (positioned.chance !== ALWAYS_CHANCE)
      return getWithState(positioned, TrackEventState.RUNNING)
    if ((positioned.flags & LOOPED_SOUND_FLAG) === 0) {
      session.emit({
        type: 'track.sound_played',
        identifier: positioned.identifier,
        soundNumber: positioned.record.keyword2cInteger,
        position: positioned.position,
      })
      return positioned
    }
    if (!session.context.world.getIsSoundAvailable(positioned.identifier)) return positioned
    session.emit({ type: 'track.looped_sound_started', identifier: positioned.identifier })
    return { ...positioned, isHandleHeld: true, state: TrackEventState.RUNNING }
  },
  end: (event, session) => {
    if (event.isHandleHeld) {
      session.emit({ type: 'track.looped_sound_stopped', identifier: event.identifier })
    }
    return { ...event, isHandleHeld: false, state: TrackEventState.INACTIVE }
  },
  update: (event, session, milliseconds) => {
    const base = endIfRequested(event, session)
    if (base.state === TrackEventState.INACTIVE) return base
    const timerMilliseconds =
      base.timerMilliseconds > milliseconds ? base.timerMilliseconds - milliseconds : 0
    if (base.chance === ALWAYS_CHANCE || timerMilliseconds !== 0) {
      return { ...base, timerMilliseconds }
    }
    const restartedMilliseconds =
      (session.drawRandomValue() % RANDOM_SOUND_PERIOD) + RANDOM_SOUND_MINIMUM_PERIOD
    if (session.drawRandomValue() % RANDOM_SOUND_CHANCE_RANGE < base.chance) {
      session.emit({
        type: 'track.sound_played',
        identifier: base.identifier,
        soundNumber: base.kind === TrackEventKind.KIND_2A ? base.record.keyword2cInteger : 0,
        position: base.position,
      })
    }
    return { ...base, timerMilliseconds: restartedMilliseconds }
  },
})

// 0x00463230, 0x00463280, 0x00463200: a material animation.
export const HANDLERS_29: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  begin: (event, session) => {
    emitAction(session, event, 'begin')
    return announceAndSet(session, event, event.state, FIRST_SIGNAL, TrackEventState.RUNNING)
  },
  end: (event, session) => {
    emitAction(session, event, 'end')
    return announceAndSet(session, event, event.state, NO_SIGNAL_PHASE, TrackEventState.INACTIVE)
  },
  update: (event, session) => {
    const base = endIfRequested(event, session)
    const isFinished =
      base.state === TrackEventState.RUNNING &&
      (base.flags & 1) === 0 &&
      !session.context.world.getIsAnimationPlaying(base.identifier)
    return isFinished ? session.endEvent(base) : base
  },
})

// The emitter 0x0045eaf0 and 0x0045ebe0 start: the name (event +0x28), the position (+0x3c) and the facing and up
// directions (+0x48, +0x54).
const getEmitterHandle = (event: TrackEvent, session: TrackSession): EmitterReference | null => {
  if (event.kind !== TrackEventKind.KIND_3D) return null
  const { orientation } = event.record
  return session.spawnEmitter(event.record.secondName, {
    position: { x: event.position[0], y: event.position[1], z: event.position[2] },
    orientation: {
      facing: { x: orientation[0], y: orientation[1], z: orientation[2] },
      up: { x: orientation[3], y: orientation[4], z: orientation[5] },
    },
  })
}

// Event +0x1c bit 0x20: the event holds an emitter (set by 0x0045eaf0 and 0x0045ebe0, cleared by 0x0045eb90).
const EMITTER_HELD_FLAG = 0x20

const getWithEmitterFlag = (event: TrackEvent): TrackEvent =>
  event.emitterHandle === null
    ? event
    : { ...event, flags: (event.flags | EMITTER_HELD_FLAG) >>> 0 }

// 0x0045eaf0, 0x0045eb90, 0x0045ebe0: a particle emitter that follows an object (the object is not ported).
export const HANDLERS_3D: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  begin: (event, session, parameter) => {
    if (event.kind !== TrackEventKind.KIND_3D) return event
    const positioned =
      parameter !== null && (event.flags & POSITION_FROM_SIGNAL_FLAG) !== 0
        ? { ...event, position: parameter }
        : event
    const emitterHandle = getEmitterHandle(positioned, session)
    return announceAndSet(
      session,
      getWithEmitterFlag({
        ...positioned,
        emitterHandle: emitterHandle ?? positioned.emitterHandle,
      }),
      positioned.state,
      FIRST_SIGNAL,
      TrackEventState.RUNNING
    )
  },
  end: (event, session) => {
    if (event.emitterHandle !== null) session.releaseEmitter(event.emitterHandle)
    return announceAndSet(
      session,
      { ...event, emitterHandle: null, flags: (event.flags & ~EMITTER_HELD_FLAG) >>> 0 },
      event.state,
      NO_SIGNAL_PHASE,
      TrackEventState.INACTIVE
    )
  },
  update: (event, session) => {
    const base = endIfRequested(event, session)
    if (base.state === TrackEventState.INACTIVE || base.emitterHandle !== null) return base
    return getWithEmitterFlag({ ...base, emitterHandle: getEmitterHandle(base, session) })
  },
})

// 0x0045e2a0, 0x0045e320: a one-shot; begin asks for the end at the next update.
export const HANDLERS_42: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  begin: (event, session) => {
    emitAction(session, event, 'begin')
    if (event.kind === TrackEventKind.KIND_42 && event.record.name !== '') {
      session.emit({
        type: 'track.sky_setting_switched',
        name: event.record.name,
        durationMilliseconds: event.record.keyword44Integer,
      })
    }
    return announceAndSet(session, event, event.state, FIRST_SIGNAL, TrackEventState.END_REQUESTED)
  },
  end: (event, session) => {
    emitAction(session, event, 'end')
    return announceAndSet(session, event, event.state, NO_SIGNAL_PHASE, TrackEventState.INACTIVE)
  },
})

// 0x0045e880, 0x0045e8a0, 0x0045e8d0: a countdown that ends the event, unless its second signal is held.
export const HANDLERS_4B: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  begin: (event, session) => {
    if (event.kind !== TrackEventKind.KIND_4B) return event
    return announceAndSet(
      session,
      { ...event, timerMilliseconds: event.record.keyword49Integer },
      TrackEventState.INACTIVE,
      FIRST_SIGNAL,
      TrackEventState.RUNNING
    )
  },
  end: (event, session) =>
    event.timerMilliseconds === 0 && !event.isSignalHeld
      ? announceAndSet(session, event, event.state, NO_SIGNAL_PHASE, TrackEventState.LAST_PHASE)
      : event,
  update: (event, session, milliseconds) => {
    const base = endIfRequested(event, session)
    if (base.state === TrackEventState.LAST_PHASE) return base
    const counted = {
      ...base,
      timerMilliseconds:
        base.timerMilliseconds < milliseconds ? 0 : base.timerMilliseconds - milliseconds,
    }
    return counted.timerMilliseconds === 0 ? session.endEvent(counted) : counted
  },
})

// 0x00463990, 0x004639b0, 0x004639d0: follows an object (not ported).
export const HANDLERS_52: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  begin: (event, session) =>
    announceAndSet(session, event, TrackEventState.INACTIVE, FIRST_SIGNAL, TrackEventState.RUNNING),
  end: (event, session) =>
    announceAndSet(session, event, event.state, NO_SIGNAL_PHASE, TrackEventState.INACTIVE),
})

// 0x004637c0, 0x00463800: switches three values of an object (not ported).
export const HANDLERS_53: TrackEventHandlers = Object.freeze({
  ...IDLE_HANDLERS,
  begin: (event, session) => {
    emitAction(session, event, 'begin')
    return getWithState(event, TrackEventState.RUNNING)
  },
  end: (event, session) => {
    emitAction(session, event, 'end')
    return getWithState(event, TrackEventState.INACTIVE)
  },
})
