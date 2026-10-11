import { parseEvents } from '../../../event/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  floatTokens,
  integerTokens,
  LEFT_CURLY,
  RIGHT_CURLY,
} from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeFloat,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { TrackEventKind, TrackEventState } from '../../types/track-event-state/track-event-state.ts'
import type { TrackEvent, TrackLogicContext } from '../../types/track-logic.types.ts'
import { createTrackLogic } from '../create-track-logic/create-track-logic.ts'
import { runTrackLogic, STATIC_TRACK_WORLD, updateTrackEvents } from './run-track-logic.ts'

const CONTEXT: TrackLogicContext = {
  arithmetic: createFloatArithmetic(FpuPrecision.SINGLE),
  world: STATIC_TRACK_WORLD,
}
const TABLE = createRandomTable(Array.from({ length: 1024 }, (_, index) => (index * 37) % 1024))

const section = (keyword: number, blocks: readonly (readonly number[])[]): readonly number[] => [
  keyword,
  ...encodeArrayHeader(blocks.length),
  ...blocks.flat(),
  RIGHT_CURLY,
]

// `0x27 identifier { ...body }`
const block = (identifier: number, body: readonly number[]): readonly number[] => [
  0x27,
  ...integerTokens([identifier]),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

const signal = (keyword: number, identifier: number): readonly number[] => [
  0x27,
  keyword,
  ...integerTokens([identifier]),
]

const createLogic = (bytes: readonly number[], position = 0) =>
  createTrackLogic(
    {
      eventSet: parseEvents(new Uint8Array(bytes), false),
      timerList: null,
      mainTriggers: null,
      environmentTriggers: null,
    },
    CONTEXT.arithmetic,
    { table: TABLE, position }
  )

const getEvent = (events: readonly TrackEvent[], index = 0): TrackEvent => {
  const event = events[index]
  if (event === undefined) throw new Error('No event')
  return event
}

describe('createTrackLogic', () => {
  it('takes one draw per 2A event for its timer and scales its chance to a byte (0x004641b0)', () => {
    // Arrange
    const bytes = section(0x2a, [block(5, [0x40, ...encodeFloat(0.5)])])

    // Act
    const logic = createLogic(bytes, 10)

    // Assert
    const event = getEvent(logic.events[TrackEventKind.KIND_2A])
    expect(logic.random.position).toBe(11)
    expect(event.timerMilliseconds).toBe((((11 * 37) % 1024) % 1000) + 500)
    expect(event.chance).toBe(127)
    expect(event.state).toBe(TrackEventState.INACTIVE)
  })

  it('draws nothing for the other classes', () => {
    // Arrange
    const bytes = section(0x42, [block(1, [])])

    // Act
    const logic = createLogic(bytes, 10)

    // Assert
    expect(logic.random.position).toBe(10)
  })
})

describe('the signal bus', () => {
  it('begins an event that carries the signal and announces its first phase signal (0x00461ef0, 0x0045edd0)', () => {
    // Arrange
    const bytes = [
      ...section(0x4b, [block(10, [...signal(0x34, 20), 0x49, ...integerTokens([100])])]),
      ...section(0x42, [block(20, [])]),
    ]
    const logic = createLogic(bytes)

    // Act
    const step = runTrackLogic(logic, CONTEXT, (session) => session.startSignal(10, null))

    // Assert
    const timed = getEvent(step.state.events[TrackEventKind.KIND_4B])
    const pulse = getEvent(step.state.events[TrackEventKind.KIND_42])
    expect(timed.state).toBe(TrackEventState.RUNNING)
    expect(timed.timerMilliseconds).toBe(100)
    expect(pulse.state).toBe(TrackEventState.END_REQUESTED)
  })

  it('ends a countdown when its time runs out and stops the signal it announced (0x0045e8d0)', () => {
    // Arrange
    const bytes = [
      ...section(0x4b, [block(10, [...signal(0x34, 20), 0x49, ...integerTokens([100])])]),
      ...section(0x42, [block(20, [])]),
    ]
    const started = runTrackLogic(createLogic(bytes), CONTEXT, (session) =>
      session.startSignal(10, null)
    )
    const pulsed = updateTrackEvents(started.state, CONTEXT, 40)

    // Act
    const step = updateTrackEvents(pulsed.state, CONTEXT, 60)

    // Assert
    expect(getEvent(pulsed.state.events[TrackEventKind.KIND_4B]).state).toBe(
      TrackEventState.RUNNING
    )
    expect(getEvent(pulsed.state.events[TrackEventKind.KIND_42]).state).toBe(
      TrackEventState.INACTIVE
    )
    expect(getEvent(step.state.events[TrackEventKind.KIND_4B]).state).toBe(
      TrackEventState.LAST_PHASE
    )
  })

  it('keeps a countdown running while the signal held by keyword 0x4c is on', () => {
    // Arrange
    const bytes = section(0x4b, [
      block(10, [0x49, ...integerTokens([50]), 0x4c, ...integerTokens([77])]),
    ])
    const started = runTrackLogic(createLogic(bytes), CONTEXT, (session) => {
      session.startSignal(77, null)
      session.startSignal(10, null)
    })

    // Act
    const step = updateTrackEvents(started.state, CONTEXT, 80)

    // Assert
    expect(getEvent(step.state.events[TrackEventKind.KIND_4B]).state).toBe(TrackEventState.RUNNING)
  })

  it('asks the linked identifiers of a 0x39 pair to end, and a countdown only ends at zero (0x00462350)', () => {
    // Arrange
    const bytes = [
      ...section(0x39, [
        [0x27, ...integerTokens([1]), LEFT_CURLY, 0x39, ...integerTokens([20]), RIGHT_CURLY],
      ]),
      ...section(0x4b, [block(20, [0x49, ...integerTokens([1000])])]),
    ]
    const running = runTrackLogic(createLogic(bytes), CONTEXT, (session) =>
      session.startSignal(20, null)
    )

    // Act
    const step = runTrackLogic(running.state, CONTEXT, (session) => session.startSignal(1, null))
    const waiting = updateTrackEvents(step.state, CONTEXT, 1)
    const ended = updateTrackEvents(waiting.state, CONTEXT, 1000)

    // Assert
    expect(getEvent(step.state.events[TrackEventKind.KIND_4B]).state).toBe(
      TrackEventState.END_REQUESTED
    )
    expect(getEvent(waiting.state.events[TrackEventKind.KIND_4B]).state).toBe(
      TrackEventState.END_REQUESTED
    )
    expect(getEvent(ended.state.events[TrackEventKind.KIND_4B]).state).toBe(
      TrackEventState.LAST_PHASE
    )
  })

  it('puts a racer in the zone of a 0x51 event a trigger fires (0x00464680)', () => {
    // Arrange
    const bytes = section(0x51, [block(40, [0x37])])

    // Act
    const step = runTrackLogic(createLogic(bytes), CONTEXT, (session) => session.fireTrigger(40, 3))

    // Assert
    expect(step.effects).toEqual([{ type: 'track.racer_zone_entered', racerIndex: 3, zone: 2 }])
  })
})

describe('the random ambient sound (0x004643e0)', () => {
  const bytes = section(0x2a, [
    block(5, [0x40, ...encodeFloat(0.5), 0x3b, ...floatTokens([1, 2, 3])]),
  ])

  it('draws a new period and a chance roll when its timer runs out, and plays on a low roll', () => {
    // Arrange
    const began = runTrackLogic(createLogic(bytes), CONTEXT, (session) =>
      session.startSignal(5, null)
    )
    const initialTimer = getEvent(began.state.events[TrackEventKind.KIND_2A]).timerMilliseconds

    // Act
    const step = updateTrackEvents(began.state, CONTEXT, initialTimer)

    // Assert
    const event = getEvent(step.state.events[TrackEventKind.KIND_2A])
    expect(step.state.random.position - began.state.random.position).toBe(2)
    expect(event.timerMilliseconds).toBeGreaterThanOrEqual(500)
    expect(event.timerMilliseconds).toBeLessThan(1500)
  })

  it('draws nothing before its timer runs out', () => {
    // Arrange
    const began = runTrackLogic(createLogic(bytes), CONTEXT, (session) =>
      session.startSignal(5, null)
    )

    // Act
    const step = updateTrackEvents(began.state, CONTEXT, 1)

    // Assert
    expect(step.state.random.position).toBe(began.state.random.position)
  })
})

describe('the 42 event (0x0045e2a0)', () => {
  it('asks the sky to switch to the named setting over its duration', () => {
    // Arrange
    const bytes = section(0x42, [
      block(20, [0x43, ...encodeString('night'), 0x44, ...integerTokens([2500])]),
    ])
    const logic = createLogic(bytes)

    // Act
    const step = runTrackLogic(logic, CONTEXT, (session) => session.startSignal(20, null))

    // Assert
    expect(step.effects).toContainEqual({
      type: 'track.sky_setting_switched',
      name: 'night',
      durationMilliseconds: 2500,
    })
  })
})
