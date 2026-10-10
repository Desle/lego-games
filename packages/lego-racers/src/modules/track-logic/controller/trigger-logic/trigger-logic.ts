import type { TriggerList } from '../../../trigger/index.ts'
import type {
  TrackSession,
  TrackTrigger,
  TrackTriggerContact,
  TrackTriggerState,
} from '../../types/track-logic.types.ts'

const NO_IDENTIFIER = -1
const TOUCHED_FLAG = 1
const ACTIVE_FLAG = 2
const RACER_MASK_WIDTH = 32

const EMPTY_TRIGGERS: TrackTriggerState = Object.freeze({
  main: Object.freeze([]),
  environment: Object.freeze([]),
})

const createTrigger = (definition: TriggerList['triggers'][number]): TrackTrigger =>
  Object.freeze({
    definition,
    flags: 0,
    racerMask: 0,
    previousRacerMask: 0,
  })

// MainTriggers_Load 0x00463dc0 and EnvironmentTriggers_Load 0x00464ff0: the triggers start untouched; nothing draws.
export const createTriggers = (
  main: TriggerList | null,
  environment: TriggerList | null
): TrackTriggerState =>
  main === null && environment === null
    ? EMPTY_TRIGGERS
    : Object.freeze({
        main: Object.freeze((main?.triggers ?? []).map(createTrigger)),
        environment: Object.freeze((environment?.triggers ?? []).map(createTrigger)),
      })

const getWithTrigger = (
  state: TrackTriggerState,
  isMain: boolean,
  index: number,
  change: (trigger: TrackTrigger) => TrackTrigger
): TrackTriggerState => {
  const replace = (triggers: readonly TrackTrigger[]): readonly TrackTrigger[] =>
    Object.freeze(
      triggers.map((trigger, current) => (current === index ? change(trigger) : trigger))
    )
  return Object.freeze(
    isMain
      ? { ...state, main: replace(state.main) }
      : { ...state, environment: replace(state.environment) }
  )
}

const getTrigger = (
  state: TrackTriggerState,
  isMain: boolean,
  index: number
): TrackTrigger | undefined => (isMain ? state.main : state.environment)[index]

// 0x00464f40: the first touch announces the trigger's identifier (with the trigger's position) and marks it active.
const activate = (
  state: TrackTriggerState,
  isMain: boolean,
  index: number,
  session: TrackSession
): TrackTriggerState => {
  const trigger = getTrigger(state, isMain, index)
  if (trigger === undefined) return state
  if ((trigger.flags & ACTIVE_FLAG) === 0 && trigger.definition.firstInteger !== NO_IDENTIFIER) {
    session.startSignal(trigger.definition.firstInteger, trigger.definition.position)
  }
  return getWithTrigger(state, isMain, index, (changed) => ({
    ...changed,
    flags: changed.flags | ACTIVE_FLAG | TOUCHED_FLAG,
  }))
}

// 0x00463c70 (a racer touches a main trigger) and 0x00464f40 (an environment trigger): the lap and tagged position
// tests, the activation, and the racer's first frame in the trigger fires its events.
export const touchTrigger = (
  state: TrackTriggerState,
  contact: TrackTriggerContact,
  session: TrackSession
): TrackTriggerState => {
  const trigger = getTrigger(state, contact.isMain, contact.triggerIndex)
  if (trigger === undefined) return state
  const { definition } = trigger
  if (contact.isMain && contact.racer !== null) {
    if (
      definition.secondInteger !== null &&
      contact.racer.currentLap !== definition.secondInteger
    ) {
      return state
    }
    if (definition.objectName !== null) {
      session.emit({
        type: 'track.tagged_position_touched',
        racerIndex: contact.racer.index,
        triggerIndex: contact.triggerIndex,
      })
    }
  }
  const activated = activate(state, contact.isMain, contact.triggerIndex, session)
  if (!contact.isMain || contact.racer === null) return activated
  const bit = 2 ** (contact.racer.index % RACER_MASK_WIDTH)
  const current = getTrigger(activated, true, contact.triggerIndex)
  if (current === undefined) return activated
  const isAlreadyInside = (current.previousRacerMask & bit) !== 0
  const marked = getWithTrigger(activated, true, contact.triggerIndex, (changed) => ({
    ...changed,
    racerMask: (changed.racerMask | bit) >>> 0,
  }))
  if (!isAlreadyInside && definition.firstInteger !== NO_IDENTIFIER) {
    session.fireTrigger(definition.firstInteger, contact.racer.index)
  }
  return marked
}

// 0x00464ef0: a trigger nobody touched this frame stops announcing its identifier.
const release = (
  state: TrackTriggerState,
  isMain: boolean,
  index: number,
  session: TrackSession
): TrackTriggerState => {
  const trigger = getTrigger(state, isMain, index)
  if (trigger === undefined) return state
  const isStopped = (trigger.flags & ACTIVE_FLAG) !== 0 && (trigger.flags & TOUCHED_FLAG) === 0
  if (isStopped && trigger.definition.firstInteger !== NO_IDENTIFIER) {
    session.stopSignal(trigger.definition.firstInteger, trigger.definition.position)
  }
  return getWithTrigger(state, isMain, index, (changed) => ({
    ...changed,
    flags: (isStopped ? changed.flags & ~ACTIVE_FLAG : changed.flags) & ~TOUCHED_FLAG,
  }))
}

// 0x00463c00: a main trigger also releases the racers that were inside last frame and are not now, then the masks
// shift. `racerCount` is the six racer slots of the original's loop.
const releaseMain = (
  state: TrackTriggerState,
  index: number,
  session: TrackSession,
  racerCount: number
): TrackTriggerState => {
  const released = release(state, true, index, session)
  const trigger = getTrigger(released, true, index)
  if (trigger === undefined) return released
  const identifier = trigger.definition.firstInteger
  if (identifier !== NO_IDENTIFIER && trigger.previousRacerMask !== 0) {
    for (let racerIndex = 0; racerIndex < racerCount; racerIndex += 1) {
      const bit = 2 ** racerIndex
      if ((trigger.previousRacerMask & bit) !== 0 && (trigger.racerMask & bit) === 0) {
        session.releaseTrigger(identifier, racerIndex)
      }
    }
  }
  return getWithTrigger(released, true, index, (changed) => ({
    ...changed,
    previousRacerMask: changed.racerMask,
    racerMask: 0,
  }))
}

// Triggers_Update: the environment triggers (race +0x2128), then the main triggers (race +0x2080), each one
// released through its vtable +0xc.
export const updateTriggers = (
  state: TrackTriggerState,
  session: TrackSession,
  racerCount: number
): TrackTriggerState => {
  const environment = state.environment.reduce(
    (current, _, index) => release(current, false, index, session),
    state
  )
  return state.main.reduce(
    (current, _, index) => releaseMain(current, index, session, racerCount),
    environment
  )
}
