import {
  createFloatArithmetic,
  getTruncatedInteger,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import { HudFont } from '../../types/hud-font/hud-font.ts'
import type {
  HudCommand,
  HudCountdown,
  HudFrame,
  HudInput,
  HudLapTexts,
  HudPoint,
  HudScale,
  HudState,
  HudTextCommand,
} from '../../types/race-hud.types.ts'
import { formatHudTime } from '../hud-time/hud-time.ts'
import { getMinimapCommands } from '../hud-minimap/hud-minimap.ts'
import { getHeldPowerUpCommands } from './held-power-up.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, subtract, multiply, storeFloat } = arithmetic

// String table ids the HUD asks GAME.SRF for (0x004263a0).
const FINISH_STRING_ID = 0x28
const GO_STRING_ID = 0x29
const BEST_LABEL_STRING_ID = 0x25
const LAP_LABEL_STRING_ID = 0x27
const WRONG_WAY_STRING_ID = 0x24
const FIRST_PLACE_STRING_ID = 0x19
// 0x004b01a4, 0x004af6fc: 1.8 and 0.001, the countdown numerals' size per remaining millisecond.
const COUNTDOWN_SCALE_PER_MILLISECOND = Math.fround(1.8 * Math.fround(0.001))
const GO_SCALE = Math.fround(1.8)
const COUNTDOWN_COLOR = 0xff00ffff
const COUNTDOWN_NUMERAL_SECONDS = 3
const COUNTDOWN_END_SECONDS = 5
const GO_FULL_SIZE_SECONDS = 4
const FINISH_TEXT_LIMIT_MILLISECONDS = -60_000
const LAP_NUMBER_GAP = 14
const LAP_LABEL_GAP = 6
const POSITION_ORDINAL_OFFSET = 5
const NO_PLACE = 8
// 0x004b02e4: 1 / 172.5.
const POP_RATE = Math.fround(0.005797)
const POP_PEAK_MILLISECONDS = 0xaf
const POP_END_MILLISECONDS = 0x15e
const POP_RESET_MILLISECONDS = 0x41a
const BLINK_PERIOD_MILLISECONDS = 250
const BLINK_DURATION_MILLISECONDS = 3000
const COUNTDOWN_SOUND = 0
const GO_SOUND = 0xf

export const createHudState = (): HudState =>
  Object.freeze({
    countdownMilliseconds: 0,
    popMilliseconds: 0,
    shownLap: -1,
    bestLapMilliseconds: 0,
    placeOverride: -1,
    shownPlace: NO_PLACE,
    lapText: '',
    currentTimeText: formatHudTime(0),
    bestTimeText: formatHudTime(0),
    totalTimeText: formatHudTime(0),
  })

// 0x00426360, at the end of the introduction: the countdown starts at 1 ms.
export const startHudCountdown = (state: HudState): HudState =>
  Object.freeze({ ...state, countdownMilliseconds: 1 })

// 0x00426370, when the racer finishes: the finish text shows and the place is the one the racer finished in.
export const finishHud = (state: HudState, racePosition: number): HudState =>
  Object.freeze({ ...state, countdownMilliseconds: -1, placeOverride: racePosition - 1 })

const getText = (
  text: string,
  font: HudTextCommand['font'],
  position: HudPoint,
  scale: HudScale,
  color: number | null = null
): HudTextCommand =>
  Object.freeze({
    kind: 'text',
    text,
    font,
    x: position.x,
    y: position.y,
    scaleX: scale.x,
    scaleY: scale.y,
    color,
  })

// The countdown numerals and GO, then the finish text (0x004263a0, 0x004263e0..0x00426740).
const getCountdown = (state: HudState, input: HudInput): HudCountdown => {
  const { layout, frameMilliseconds } = input
  const drawCentered = (text: string, scale: HudScale, color: number | null) => {
    const size = input.measureText(HudFont.DIGITS, text)
    const width = getTruncatedInteger(multiply(size.width, scale.x))
    const height = getTruncatedInteger(multiply(size.height, scale.y))
    return getText(
      text,
      HudFont.DIGITS,
      { x: layout.centerX - (width >> 1), y: layout.countdownY - (height >> 2) },
      scale,
      color
    )
  }
  const before = state.countdownMilliseconds
  if (before > 0) {
    const elapsed = before + frameMilliseconds
    const second = Math.trunc(elapsed / 1000)
    const previousSecond = Math.trunc(before / 1000)
    const remaining = (second + 1) * 1000 - elapsed
    const countdownScale = storeFloat(multiply(remaining, COUNTDOWN_SCALE_PER_MILLISECOND))
    const getScale = (size: number): HudScale => ({
      x: storeFloat(multiply(layout.horizontalScale, size)),
      y: storeFloat(multiply(layout.verticalScale, size)),
    })
    if (second < COUNTDOWN_NUMERAL_SECONDS) {
      return {
        state: { ...state, countdownMilliseconds: elapsed },
        commands: [
          drawCentered(
            String(COUNTDOWN_NUMERAL_SECONDS - second),
            getScale(countdownScale),
            COUNTDOWN_COLOR
          ),
        ],
        soundIds: before === 1 || previousSecond !== second ? [COUNTDOWN_SOUND] : [],
      }
    }
    if (second < COUNTDOWN_END_SECONDS) {
      const size = second < GO_FULL_SIZE_SECONDS ? GO_SCALE : countdownScale
      return {
        state: { ...state, countdownMilliseconds: elapsed },
        commands: [drawCentered(input.getString(GO_STRING_ID), getScale(size), COUNTDOWN_COLOR)],
        soundIds:
          second === COUNTDOWN_NUMERAL_SECONDS && previousSecond !== second ? [GO_SOUND] : [],
      }
    }
    return { state: { ...state, countdownMilliseconds: 0 }, commands: [], soundIds: [] }
  }
  if (before < 0) {
    const scale = { x: layout.horizontalScale, y: layout.verticalScale }
    return {
      state: {
        ...state,
        countdownMilliseconds: Math.max(before - frameMilliseconds, FINISH_TEXT_LIMIT_MILLISECONDS),
      },
      commands: [drawCentered(input.getString(FINISH_STRING_ID), scale, null)],
      soundIds: [],
    }
  }
  return { state, commands: [], soundIds: [] }
}

const getSum = (times: readonly number[], count: number): number =>
  times.slice(0, Math.max(count, 0)).reduce((sum, time) => sum + time, 0)

// 0x004267a9..0x00426935: the current lap time (blinking for three seconds after a lap or the finish), the total
// time, the best lap time and the lap number.
const getHudLapTexts = (state: HudState, input: HudInput): HudLapTexts => {
  const { racer } = input
  const { currentLap, lapCount, lapMilliseconds } = racer
  const timeOf = (lap: number): number => lapMilliseconds[lap] ?? 0
  let currentTimeText = state.currentTimeText
  let isTimeShown = true
  let total: number
  if (currentLap < lapCount) {
    const lapTime = timeOf(currentLap)
    if (currentLap === 0 || lapTime >= BLINK_DURATION_MILLISECONDS) {
      currentTimeText = formatHudTime(lapTime)
    } else if (Math.floor(lapTime / BLINK_PERIOD_MILLISECONDS) % 2 === 0) {
      currentTimeText = formatHudTime(timeOf(currentLap - 1))
    } else {
      isTimeShown = false
    }
    total = getSum(lapMilliseconds, currentLap + 1)
  } else {
    const sinceFinish = -state.countdownMilliseconds
    if (
      sinceFinish < BLINK_DURATION_MILLISECONDS &&
      Math.floor(sinceFinish / BLINK_PERIOD_MILLISECONDS) % 2 === 1
    ) {
      isTimeShown = false
    } else {
      currentTimeText = formatHudTime(timeOf(lapCount - 1))
    }
    total = getSum(lapMilliseconds, currentLap)
  }
  const isNewLap = currentLap !== state.shownLap
  const shownLapTime = timeOf(state.shownLap)
  const isBestLapBeaten =
    isNewLap &&
    state.shownLap !== -1 &&
    state.shownLap < lapCount &&
    (shownLapTime <= state.bestLapMilliseconds || state.bestLapMilliseconds === 0)
  return {
    lapText: isNewLap ? String(Math.min(currentLap + 1, lapCount)) : state.lapText,
    currentTimeText,
    bestTimeText: isBestLapBeaten ? formatHudTime(shownLapTime) : state.bestTimeText,
    totalTimeText: formatHudTime(total),
    bestLapMilliseconds: isBestLapBeaten ? shownLapTime : state.bestLapMilliseconds,
    shownLap: currentLap,
    isTimeShown,
  }
}

// The scale of the place number while it pops (0x00426cb3..0x00426d22): it grows to twice its size in 175 ms,
// shrinks back by 350 ms and stays until 1,050 ms.
const getPop = (popMilliseconds: number, frameMilliseconds: number) => {
  if (popMilliseconds === 0) return { popMilliseconds: 0, size: 1 }
  const elapsed = popMilliseconds + frameMilliseconds
  if (elapsed > POP_END_MILLISECONDS) {
    return { popMilliseconds: elapsed > POP_RESET_MILLISECONDS ? 0 : elapsed, size: 1 }
  }
  const size =
    elapsed > POP_PEAK_MILLISECONDS
      ? subtract(2, multiply(elapsed - POP_PEAK_MILLISECONDS, POP_RATE))
      : add(multiply(elapsed, POP_RATE), 1)
  return { popMilliseconds: elapsed, size: storeFloat(size) }
}

// Hud_Update 0x00426390 plus the draw routine 0x004263a0 for viewport mode 1: the countdown, the lap and best-lap
// rows, the place, the wrong-way warning and the held power-up. Not ported: the gap-to-leader row (racer +0xd84,
// whose value at +0xd88 the racer module does not keep), the displays chosen by the HUD mode binding (0x004249b0,
// 0x004258e0, 0x00424fb0) and the split-screen modes.
export const getHudFrame = (state: HudState, input: HudInput): HudFrame => {
  const countdown = getCountdown(state, input)
  const { layout, racer, frameMilliseconds } = input
  if (racer.isWarping) {
    return Object.freeze({
      state: Object.freeze(countdown.state),
      commands: Object.freeze(countdown.commands),
      soundIds: Object.freeze(countdown.soundIds),
    })
  }
  const lapTexts = getHudLapTexts(countdown.state, input)
  const unitScale = { x: layout.horizontalScale, y: layout.verticalScale }
  const place = Math.min(
    countdown.state.popMilliseconds === 0
      ? countdown.state.placeOverride < 0
        ? racer.racePosition - 1
        : countdown.state.placeOverride
      : countdown.state.shownPlace,
    NO_PLACE
  )
  const isPlaceChanged =
    countdown.state.popMilliseconds === 0 && place !== countdown.state.shownPlace
  const pop = getPop(isPlaceChanged ? 1 : countdown.state.popMilliseconds, frameMilliseconds)
  const commands: HudCommand[] = [...countdown.commands]
  const alignTime = (text: string): number =>
    layout.timeColumnX + (text.length === 7 ? layout.longTimeWidth - layout.shortTimeWidth : 0)
  const lapSize = input.measureText(HudFont.TEXT, lapTexts.lapText)
  const lapX =
    layout.timeColumnX -
    getTruncatedInteger(multiply(lapSize.width + LAP_NUMBER_GAP, layout.horizontalScale))
  commands.push(
    getText(lapTexts.lapText, HudFont.TEXT, { x: lapX, y: layout.firstRowY }, unitScale)
  )
  const lapLabel = input.getString(LAP_LABEL_STRING_ID)
  const labelSize = input.measureText(HudFont.TEXT, lapLabel)
  commands.push(
    getText(
      lapLabel,
      HudFont.TEXT,
      {
        x:
          lapX -
          getTruncatedInteger(multiply(labelSize.width + LAP_LABEL_GAP, layout.horizontalScale)),
        y: layout.firstRowY,
      },
      unitScale
    )
  )
  if (lapTexts.isTimeShown) {
    commands.push(
      getText(
        lapTexts.currentTimeText,
        HudFont.TEXT,
        { x: alignTime(lapTexts.currentTimeText), y: layout.firstRowY },
        unitScale
      )
    )
  }
  if (lapTexts.bestLapMilliseconds !== 0) {
    const bestLabel = input.getString(BEST_LABEL_STRING_ID)
    const bestSize = input.measureText(HudFont.TEXT, bestLabel)
    commands.push(
      getText(
        bestLabel,
        HudFont.TEXT,
        {
          x:
            layout.timeColumnX -
            getTruncatedInteger(multiply(bestSize.width + LAP_NUMBER_GAP, layout.horizontalScale)),
          y: layout.secondRowY,
        },
        unitScale
      ),
      getText(
        lapTexts.bestTimeText,
        HudFont.TEXT,
        { x: alignTime(lapTexts.bestTimeText), y: layout.secondRowY },
        unitScale
      )
    )
  }
  if (place !== NO_PLACE) {
    const digit = String(place + 1)
    const digitSize = input.measureText(HudFont.DIGITS, digit)
    const digitWidth = getTruncatedInteger(multiply(digitSize.width, layout.horizontalScale))
    commands.push(
      getText(
        input.getString(FIRST_PLACE_STRING_ID + place),
        HudFont.TEXT,
        {
          x:
            layout.positionX +
            getTruncatedInteger(multiply(layout.horizontalScale, POSITION_ORDINAL_OFFSET)),
          y: layout.firstRowY,
        },
        unitScale
      ),
      getText(
        digit,
        HudFont.DIGITS,
        { x: layout.positionX - digitWidth, y: layout.firstRowY },
        {
          x: storeFloat(multiply(layout.horizontalScale, pop.size)),
          y: storeFloat(multiply(layout.verticalScale, pop.size)),
        }
      )
    )
  }
  if (racer.isWrongWay) {
    commands.push(
      getText(
        input.getString(WRONG_WAY_STRING_ID),
        HudFont.TEXT,
        { x: layout.wrongWayX, y: layout.wrongWayY },
        unitScale
      )
    )
  }
  commands.push(...getHeldPowerUpCommands(input))
  if (input.minimap !== null) commands.push(...getMinimapCommands(layout, input.minimap))
  return Object.freeze({
    state: Object.freeze({
      ...countdown.state,
      popMilliseconds: place === NO_PLACE ? 0 : pop.popMilliseconds,
      shownPlace: place,
      shownLap: lapTexts.shownLap,
      lapText: lapTexts.lapText,
      currentTimeText: lapTexts.currentTimeText,
      bestTimeText: lapTexts.bestTimeText,
      totalTimeText: lapTexts.totalTimeText,
      bestLapMilliseconds: lapTexts.bestLapMilliseconds,
    }),
    commands: Object.freeze(commands),
    soundIds: Object.freeze(countdown.soundIds),
  })
}
