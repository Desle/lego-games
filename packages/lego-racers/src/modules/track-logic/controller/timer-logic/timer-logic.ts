import type { Timer, TimerList } from '../../../timer/index.ts'
import type { RandomTable, RandomTablePosition } from '../../../random-table/index.ts'
import { drawRandomScaledRange } from '../../../random-table/index.ts'
import type {
  TimeEntry,
  TrackTimer,
  TrackTimerSession,
  TrackTimerState,
  TimerSetupProgress,
} from '../../types/track-logic.types.ts'

const NO_IDENTIFIER = -1

const EMPTY_TIMERS: TrackTimerState = Object.freeze({
  timers: Object.freeze([]),
  entries: Object.freeze([]),
})

// 0x00464a40: a timer registers a one-shot time entry at the head of the registry's time list (0x0042fb90), which
// starts with no time elapsed.
const getWithEntry = (
  state: TrackTimerState,
  timerIndex: number,
  delayMilliseconds: number
): TrackTimerState =>
  Object.freeze({
    ...state,
    entries: Object.freeze([
      { timerIndex, delayMilliseconds, elapsedMilliseconds: 0 },
      ...state.entries,
    ]),
  })

const getWithTimer = (
  state: TrackTimerState,
  timerIndex: number,
  change: (timer: TrackTimer) => TrackTimer
): TrackTimerState =>
  Object.freeze({
    ...state,
    timers: Object.freeze(
      state.timers.map((timer, index) => (index === timerIndex ? change(timer) : timer))
    ),
  })

// Timers_Load 0x00464aa0 → Timer_Setup 0x00464750: a marked second value takes one draw; a timer with no third value
// starts with it, the others wait for Timers_Update.
export const createTimers = (
  list: TimerList | null,
  table: RandomTable,
  position: RandomTablePosition
): TimerSetupProgress => {
  const progress = (list?.timers ?? []).reduce<TimerSetupProgress>(
    (made, definition: Timer) => {
      const timerIndex = made.state.timers.length
      const timer: TrackTimer = Object.freeze({
        definition,
        remainingStartMilliseconds: definition.thirdValue,
        isSecondPhase: false,
      })
      const withTimer: TrackTimerState = Object.freeze({
        ...made.state,
        timers: Object.freeze([...made.state.timers, timer]),
      })
      if (!definition.isSecondValueRandomised) {
        return {
          state:
            definition.thirdValue === 0
              ? getWithEntry(withTimer, timerIndex, definition.secondValue)
              : withTimer,
          position: made.position,
        }
      }
      const draw = drawRandomScaledRange(table, made.position, definition.secondValue)
      return {
        state:
          definition.thirdValue === 0 ? getWithEntry(withTimer, timerIndex, draw.value) : withTimer,
        position: draw.position,
      }
    },
    { state: EMPTY_TIMERS, position }
  )
  return { state: progress.state, position: progress.position }
}

// Timers_Update 0x00464dd0 → 0x00464830: a timer with a third value counts it down and then starts with its first
// value (marked first values take a draw).
export const updateTimers = (
  state: TrackTimerState,
  session: TrackTimerSession,
  milliseconds: number
): TrackTimerState =>
  state.timers.reduce((current, timer, timerIndex) => {
    if (timer.remainingStartMilliseconds === 0) return current
    if (timer.remainingStartMilliseconds > milliseconds) {
      return getWithTimer(current, timerIndex, (changed) => ({
        ...changed,
        remainingStartMilliseconds: changed.remainingStartMilliseconds - milliseconds,
      }))
    }
    const started = getWithTimer(current, timerIndex, (changed) => ({
      ...changed,
      remainingStartMilliseconds: 0,
    }))
    const first = timer.definition.firstValue >>> 0
    const delay = timer.definition.isFirstValueMarked ? session.drawScaledRange(first) : first
    return getWithEntry(started, timerIndex, delay)
  }, state)

// 0x004648d0: the callback of a timer's time entry; `elapsed` is the entry's time when it fired.
const fireTimer = (
  state: TrackTimerState,
  timerIndex: number,
  elapsedMilliseconds: number,
  session: TrackTimerSession
): TrackTimerState => {
  const timer = state.timers[timerIndex]
  if (timer === undefined) return state
  const { definition } = timer
  const identifier = definition.identifier
  const first = definition.firstValue >>> 0
  const second = definition.secondValue >>> 0
  const getReducedDelay = (value: number, waited: number): number => {
    const overshoot = (elapsedMilliseconds - waited) >>> 0
    return overshoot < value ? value - overshoot : value
  }
  if (!timer.isSecondPhase) {
    if (identifier !== NO_IDENTIFIER) session.startSignal(identifier, null)
    const reduced = getReducedDelay(first, second)
    const delay = definition.isFirstValueMarked ? session.drawScaledRange(reduced) : reduced
    return getWithEntry(
      getWithTimer(state, timerIndex, (changed) => ({ ...changed, isSecondPhase: true })),
      timerIndex,
      delay
    )
  }
  if (identifier !== NO_IDENTIFIER) session.stopSignal(identifier, null)
  const reduced = getReducedDelay(second, first)
  const delay = definition.isSecondValueRandomised ? session.drawScaledRange(reduced) : reduced
  return getWithEntry(
    getWithTimer(state, timerIndex, (changed) => ({ ...changed, isSecondPhase: false })),
    timerIndex,
    delay
  )
}

// The time list of the registry (0x0042fc10), ticked in pass 4 of every sub-step: every entry gains the time, the
// ones that reach their delay fire (head of the list first, their callbacks may add entries at the head, which wait
// for the next tick), and the fired ones leave the list.
export const tickTimeEntries = (
  state: TrackTimerState,
  session: TrackTimerSession,
  milliseconds: number
): TrackTimerState => {
  const visited = state.entries.map((entry): TimeEntry => ({
    ...entry,
    elapsedMilliseconds: entry.elapsedMilliseconds + milliseconds,
  }))
  const fired = visited.filter((entry) => entry.delayMilliseconds <= entry.elapsedMilliseconds)
  const kept = visited.filter((entry) => entry.delayMilliseconds > entry.elapsedMilliseconds)
  const afterFiring = fired.reduce<TrackTimerState>(
    (current, entry) => fireTimer(current, entry.timerIndex, entry.elapsedMilliseconds, session),
    Object.freeze({ ...state, entries: Object.freeze([]) })
  )
  return Object.freeze({
    ...afterFiring,
    entries: Object.freeze([...afterFiring.entries, ...kept]),
  })
}
