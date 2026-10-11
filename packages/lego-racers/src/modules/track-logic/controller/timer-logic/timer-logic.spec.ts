import { parseEvents } from '../../../event/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Timer } from '../../../timer/index.ts'
import { integerTokens, LEFT_CURLY, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import { encodeArrayHeader } from '../../../../shared/token-encoding/token-encoding.ts'
import { TrackEventKind, TrackEventState } from '../../types/track-event-state/track-event-state.ts'
import type { TrackLogicContext } from '../../types/track-logic.types.ts'
import { createTrackLogic } from '../create-track-logic/create-track-logic.ts'
import { runTrackLogic, STATIC_TRACK_WORLD } from '../run-track-logic/run-track-logic.ts'

const CONTEXT: TrackLogicContext = {
  arithmetic: createFloatArithmetic(FpuPrecision.SINGLE),
  world: STATIC_TRACK_WORLD,
}
const TABLE = createRandomTable(Array.from({ length: 1024 }, (_, index) => (index * 37) % 1024))

// A 4B event with identifier 9 and a long countdown, so the timer's signal is easy to see.
const EVENT_BYTES = new Uint8Array([
  0x4b,
  ...encodeArrayHeader(1),
  0x27,
  ...integerTokens([9]),
  LEFT_CURLY,
  0x49,
  ...integerTokens([100000]),
  RIGHT_CURLY,
  RIGHT_CURLY,
])

const createTimer = (overrides: Partial<Timer>): Timer => ({
  firstValue: 200,
  isFirstValueMarked: false,
  secondValue: 300,
  isSecondValueRandomised: false,
  thirdValue: 0,
  identifier: 9,
  ...overrides,
})

const createLogic = (timer: Timer, position = 0) =>
  createTrackLogic(
    {
      eventSet: parseEvents(EVENT_BYTES, false),
      timerList: { timers: [timer], readByteCount: 0 },
      mainTriggers: null,
      environmentTriggers: null,
    },
    CONTEXT.arithmetic,
    { table: TABLE, position }
  )

const getEventState = (logic: ReturnType<typeof createLogic>): number =>
  logic.events[TrackEventKind.KIND_4B][0]?.state ?? -1

describe('the timers', () => {
  it('registers an entry with the second value when the third value is 0 (0x00464750)', () => {
    // Arrange / Act
    const logic = createLogic(createTimer({}))

    // Assert
    expect(logic.timers.entries).toEqual([
      { timerIndex: 0, delayMilliseconds: 300, elapsedMilliseconds: 0 },
    ])
  })

  it('waits for the third value before starting with the first value (0x00464830)', () => {
    // Arrange
    const logic = createLogic(createTimer({ thirdValue: 500 }))

    // Act
    const waiting = runTrackLogic(logic, CONTEXT, (session) => session.updateTimers(300))
    const started = runTrackLogic(waiting.state, CONTEXT, (session) => session.updateTimers(300))

    // Assert
    expect(logic.timers.entries).toEqual([])
    expect(waiting.state.timers.entries).toEqual([])
    expect(started.state.timers.entries).toEqual([
      { timerIndex: 0, delayMilliseconds: 200, elapsedMilliseconds: 0 },
    ])
  })

  it('starts its signal after the second value and stops it after the first (0x004648d0)', () => {
    // Arrange
    const logic = createLogic(createTimer({}))

    // Act
    const started = runTrackLogic(logic, CONTEXT, (session) => session.tickTimeEntries(300))
    const stopped = runTrackLogic(started.state, CONTEXT, (session) => session.tickTimeEntries(200))

    // Assert
    expect(getEventState(logic)).toBe(TrackEventState.LAST_PHASE)
    expect(getEventState(started.state)).toBe(TrackEventState.RUNNING)
    expect(started.state.timers.entries).toEqual([
      { timerIndex: 0, delayMilliseconds: 200, elapsedMilliseconds: 0 },
    ])
    expect(stopped.state.timers.entries).toEqual([
      { timerIndex: 0, delayMilliseconds: 300, elapsedMilliseconds: 0 },
    ])
  })

  it('subtracts the time a timer overshot from its next wait', () => {
    // Arrange
    const logic = createLogic(createTimer({}))

    // Act
    const step = runTrackLogic(logic, CONTEXT, (session) => session.tickTimeEntries(340))

    // Assert
    expect(step.state.timers.entries).toEqual([
      { timerIndex: 0, delayMilliseconds: 160, elapsedMilliseconds: 0 },
    ])
  })

  it('takes one draw for a marked second value and one per marked wait (0x00464750, 0x004648d0)', () => {
    // Arrange
    const timer = createTimer({ isSecondValueRandomised: true, isFirstValueMarked: true })
    const logic = createLogic(timer, 0)

    // Act
    const step = runTrackLogic(logic, CONTEXT, (session) => session.tickTimeEntries(1000))

    // Assert
    expect(logic.random.position).toBe(1)
    expect(logic.timers.entries[0]?.delayMilliseconds).toBe(((1 * 37) % 1024) % 300)
    expect(step.state.random.position).toBe(2)
  })

  it('visits the newest entry first', () => {
    // Arrange
    const first = createTimer({ identifier: 9, secondValue: 100 })
    const second = createTimer({ identifier: -1, secondValue: 100 })
    const logic = createTrackLogic(
      {
        eventSet: parseEvents(EVENT_BYTES, false),
        timerList: { timers: [first, second], readByteCount: 0 },
        mainTriggers: null,
        environmentTriggers: null,
      },
      CONTEXT.arithmetic,
      { table: TABLE, position: 0 }
    )

    // Assert
    expect(logic.timers.entries.map((entry) => entry.timerIndex)).toEqual([1, 0])
  })
})
