import { createEnum } from '../../../../shared/types/enum.types.ts'

// Event +0x18: the state machine 0x0045ee50 (begin), 0x0045ee70 (end), 0x0045edc0 (update) and 0x0045edd0 (announce)
// drive. The numbers are the original's; the names describe what the code does with them.
export const TrackEventState = Object.freeze({
  UNSET: 0,
  INACTIVE: 1,
  FIRST_PHASE: 2,
  RUNNING: 3,
  LAST_PHASE: 4,
  END_REQUESTED: 5,
})

// Event +0x1c bit 4: asked to end while inactive, the event begins and ends at once (a pulse).
export const EVENT_PULSE_FLAG = 4
// Event +0x1c bit 2: the event is never ended by 0x0045ee70.
export const EVENT_HELD_FLAG = 2

// The kinds of Events_Load's arrays, named after their section keyword.
export const TrackEventKind = createEnum({
  KIND_2A: 'kind_2a',
  KIND_28: 'kind_28',
  KIND_29: 'kind_29',
  KIND_3D: 'kind_3d',
  KIND_42: 'kind_42',
  KIND_4B: 'kind_4b',
  KIND_52: 'kind_52',
  KIND_53: 'kind_53',
  KIND_59: 'kind_59',
  KIND_4D: 'kind_4d',
  KIND_51: 'kind_51',
  KIND_55: 'kind_55',
})
