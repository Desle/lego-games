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
import { EMPTY_WORLD_ANIMATION, NO_TEXTURE_SCROLL } from '../../../world-animation/index.ts'
import type { RaceWorlds } from '../../../world-animation/index.ts'
import { TrackEventKind, TrackEventState } from '../../types/track-event-state/track-event-state.ts'
import type { TrackEvent, TrackLogicContext } from '../../types/track-logic.types.ts'
import { createTrackLogic } from '../create-track-logic/create-track-logic.ts'
import {
  runTrackLogic,
  STATIC_TRACK_WORLD,
  updateTrackEvents,
  updateTrackLogicFrame,
} from './run-track-logic.ts'

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

const BEAM_DISTANCES = Object.freeze([640000, 3.4028234663852886e38, 3.4028234663852886e38])
const BEAM_WORLDS: RaceWorlds = Object.freeze({
  track: EMPTY_WORLD_ANIMATION,
  blended: Object.freeze({
    ...EMPTY_WORLD_ANIMATION,
    meshInstances: Object.freeze([
      Object.freeze({
        name: 'beam',
        position: Object.freeze([0, 0, 0] as const),
        levelSquaredDistances: BEAM_DISTANCES,
        otherFlags: 0,
        textureScroll: NO_TEXTURE_SCROLL,
      }),
    ]),
  }),
  local: EMPTY_WORLD_ANIMATION,
})

const createLogicWithBeam = (bytes: readonly number[]) =>
  createTrackLogic(
    {
      eventSet: parseEvents(new Uint8Array(bytes), false),
      timerList: null,
      mainTriggers: null,
      environmentTriggers: null,
      worlds: BEAM_WORLDS,
    },
    CONTEXT.arithmetic,
    { table: TABLE, position: 0 }
  )

const getBeamDistances = (worlds: RaceWorlds): readonly number[] | undefined =>
  worlds.blended.meshInstances[0]?.levelSquaredDistances

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

describe('a 53 event (0x00461070, 0x00463700, 0x004637c0, 0x00463800)', () => {
  const hiddenBytes = section(0x53, [block(3, [0x41, 0x33, ...encodeString('beam')])])

  it('keeps the distances of the object it names and hides it as it loads', () => {
    // Arrange / Act
    const logic = createLogicWithBeam(hiddenBytes)

    // Assert
    expect(getEvent(logic.events[TrackEventKind.KIND_53]).savedLevelSquaredDistances).toEqual(
      BEAM_DISTANCES
    )
    expect(getBeamDistances(logic.worlds)).toEqual([-1, -1, -1])
  })

  it('shows the object while its signal runs and hides it again when the signal stops', () => {
    // Arrange
    const logic = createLogicWithBeam(hiddenBytes)

    // Act
    const shown = runTrackLogic(logic, CONTEXT, (session) => session.startSignal(3, null))
    const hidden = runTrackLogic(shown.state, CONTEXT, (session) => session.stopSignal(3, null))

    // Assert
    expect(getBeamDistances(shown.state.worlds)).toEqual(BEAM_DISTANCES)
    expect(getBeamDistances(hidden.state.worlds)).toEqual([-1, -1, -1])
  })

  it("leaves a braced event's object as it was at load", () => {
    // Arrange
    const bracedBytes = section(0x53, [
      [
        0x27,
        ...integerTokens([3]),
        0x3c,
        LEFT_CURLY,
        0x41,
        0x33,
        ...encodeString('beam'),
        RIGHT_CURLY,
      ],
    ])

    // Act
    const logic = createLogicWithBeam(bracedBytes)

    // Assert
    expect(getBeamDistances(logic.worlds)).toEqual(BEAM_DISTANCES)
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

describe('the 4D events (0x00465600, 0x00465690)', () => {
  const shiftBlock = (identifier: number, extra: readonly number[]) =>
    block(identifier, [
      0x4e,
      ...integerTokens([1, 1, 1, 0]),
      0x4f,
      ...integerTokens([0, 0, 16, 0]),
      ...extra,
    ])

  it('shifts the colours of the racer an event fires on and ends the shift when a surface releases it', () => {
    // Arrange
    const bytes = section(0x4d, [shiftBlock(8, [])])

    // Act
    const fired = runTrackLogic(createLogic(bytes), CONTEXT, (session) => session.fireTrigger(8, 2))
    const released = runTrackLogic(fired.state, CONTEXT, (session) =>
      session.fireReleaseTrigger(99, 8, 2)
    )

    // Assert
    expect(fired.effects).toContainEqual({
      type: 'track.racer_colour_shift_changed',
      racerIndex: 2,
      shifts: [1, 1, 1, 0],
      biases: [0, 0, 16, 0],
    })
    expect(released.effects).toContainEqual({
      type: 'track.racer_colour_shift_changed',
      racerIndex: 2,
      shifts: null,
      biases: [0, 0, 0, 0],
    })
  })

  it('ends the shift when the block with keyword 0x50 fires, and does nothing on its release', () => {
    // Arrange
    const bytes = section(0x4d, [shiftBlock(9, [0x50])])

    // Act
    const fired = runTrackLogic(createLogic(bytes), CONTEXT, (session) => session.fireTrigger(9, 1))
    const released = runTrackLogic(fired.state, CONTEXT, (session) =>
      session.fireReleaseTrigger(99, 9, 1)
    )

    // Assert
    expect(fired.effects).toContainEqual({
      type: 'track.racer_colour_shift_changed',
      racerIndex: 1,
      shifts: null,
      biases: [0, 0, 0, 0],
    })
    expect(
      released.effects.filter((effect) => effect.type === 'track.racer_colour_shift_changed')
    ).toEqual([])
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

describe('the signals of a projectile hitting a surface (0x0041f730)', () => {
  const POSITION: readonly [number, number, number] = [-402, 508, 100]
  const bytes = [
    ...section(0x4b, [block(7, [...signal(0x34, 20), 0x49, ...integerTokens([100])])]),
    ...section(0x42, [block(20, [])]),
  ]

  it('starts and stops the signal of the hit surface in the frame that carries it', () => {
    // Arrange
    const logic = createLogic(bytes)

    // Act
    const step = updateTrackLogicFrame(logic, CONTEXT, 33, 1, [
      { identifier: 7, position: POSITION },
    ])

    // Assert
    const timed = getEvent(step.state.events[TrackEventKind.KIND_4B])
    expect(timed.state).toBe(TrackEventState.RUNNING)
  })

  it('leaves the events alone when no projectile hit a surface', () => {
    // Arrange
    const logic = createLogic(bytes)

    // Act
    const step = updateTrackLogicFrame(logic, CONTEXT, 33, 1)

    // Assert
    const timed = getEvent(step.state.events[TrackEventKind.KIND_4B])
    expect(timed.state).not.toBe(TrackEventState.RUNNING)
  })
})
