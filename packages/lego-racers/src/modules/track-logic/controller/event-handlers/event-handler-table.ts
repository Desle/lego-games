import { TrackEventKind } from '../../types/track-event-state/track-event-state.ts'
import type { TrackEventHandlers } from '../../types/track-logic.types.ts'
import { HANDLERS_28 } from './animation-event-handlers.ts'
import {
  HANDLERS_29,
  HANDLERS_2A,
  HANDLERS_3D,
  HANDLERS_42,
  HANDLERS_4B,
  HANDLERS_52,
  HANDLERS_53,
} from './bus-event-handlers.ts'
import { IDLE_HANDLERS } from './event-handler-helpers.ts'
import { HANDLERS_4D, HANDLERS_51, HANDLERS_55, HANDLERS_59 } from './trigger-event-handlers.ts'

// The vtable of each class (the slots are listed in .docs/reverse-engineering/event.md).
export const EVENT_HANDLERS: Readonly<Record<string, TrackEventHandlers>> = Object.freeze({
  [TrackEventKind.KIND_2A]: HANDLERS_2A,
  [TrackEventKind.KIND_28]: HANDLERS_28,
  [TrackEventKind.KIND_29]: HANDLERS_29,
  [TrackEventKind.KIND_3D]: HANDLERS_3D,
  [TrackEventKind.KIND_42]: HANDLERS_42,
  [TrackEventKind.KIND_4B]: HANDLERS_4B,
  [TrackEventKind.KIND_52]: HANDLERS_52,
  [TrackEventKind.KIND_53]: HANDLERS_53,
  [TrackEventKind.KIND_4D]: HANDLERS_4D,
  [TrackEventKind.KIND_51]: HANDLERS_51,
  [TrackEventKind.KIND_55]: HANDLERS_55,
  [TrackEventKind.KIND_59]: HANDLERS_59,
})

export const getEventHandlers = (kind: string): TrackEventHandlers =>
  EVENT_HANDLERS[kind] ?? IDLE_HANDLERS
