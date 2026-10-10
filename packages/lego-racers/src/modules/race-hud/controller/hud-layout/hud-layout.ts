import {
  createFloatArithmetic,
  getTruncatedInteger,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import { HudFont } from '../../types/hud-font/hud-font.ts'
import type { HudLayout, HudLayoutParameters } from '../../types/race-hud.types.ts'
import { formatHudTime, LONGEST_TIME_MILLISECONDS } from '../hud-time/hud-time.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { multiply, divide, add, storeFloat } = arithmetic

// 0x004b02d8: 1 / 480.
const DESIGN_HEIGHT_RECIPROCAL = Math.fround(1 / 480)
// 0x004b02d4: the first row sits this many design pixels (scaled) below the top: `top - ftol(scale * -7)`.
const FIRST_ROW_OFFSET = -7
// 0x004afde0: added to the holder image's height before scaling.
const HOLDER_MARGIN = 10
// The string table entry for the wrong-way text, measured to centre it (0x00426112: 0x24).
const WRONG_WAY_STRING_ID = 0x24
// Image database entry 0xb is the power-up holder (0x0042616c).
export const HOLDER_IMAGE_INDEX = 0xb

const scaleToInteger = (value: number, scale: number): number =>
  getTruncatedInteger(multiply(value, scale))

// FUN_004261f0 and FUN_00425e90 (viewport mode 1, the whole screen, every scale 1.0): the 640 × 480 design is
// scaled to the screen, and the positions of the columns and rows come from the widths of the shortest and the
// longest time string and the height of the text.
export const getHudLayout = (parameters: HudLayoutParameters): HudLayout => {
  const { screenWidth, screenHeight, measureText, getString, holderSize } = parameters
  const verticalScale = storeFloat(multiply(screenHeight, DESIGN_HEIGHT_RECIPROCAL))
  const aspect = storeFloat(divide(screenWidth * 3, screenHeight * 4))
  const horizontalScale = storeFloat(multiply(verticalScale, aspect))
  const shortTime = measureText(HudFont.TEXT, formatHudTime(0))
  const longTime = measureText(HudFont.TEXT, formatHudTime(LONGEST_TIME_MILLISECONDS))
  const shortTimeWidth = scaleToInteger(shortTime.width, horizontalScale)
  const longTimeWidth = scaleToInteger(longTime.width, horizontalScale)
  const timeColumnX = screenWidth - ((longTimeWidth * 11) >> 3)
  const firstRowY = -getTruncatedInteger(multiply(verticalScale, FIRST_ROW_OFFSET))
  const getRowY = (eighths: number): number =>
    firstRowY + scaleToInteger((longTime.height * eighths) >> 3, verticalScale)
  const wrongWay = measureText(HudFont.TEXT, getString(WRONG_WAY_STRING_ID))
  const centerX = screenWidth >> 1
  return Object.freeze({
    screenWidth,
    screenHeight,
    horizontalScale,
    verticalScale,
    shortTimeWidth,
    longTimeWidth,
    centerX,
    positionX: Math.floor(screenWidth / 10),
    timeColumnX,
    wrongWayX: centerX - (scaleToInteger(wrongWay.width, horizontalScale) >> 1),
    holderX: screenWidth >> 5,
    countdownY: getRowY(21),
    firstRowY,
    secondRowY: getRowY(7),
    thirdRowY: getRowY(14),
    gapRowY: getRowY(21),
    wrongWayY: Math.trunc(screenHeight / 5),
    holderY:
      screenHeight -
      getTruncatedInteger(
        multiply(add(holderSize.height, HOLDER_MARGIN), verticalScale)
      ),
  })
}
