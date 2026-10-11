import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { HudFont as HudFontValues } from './hud-font/hud-font.ts'

export type HudFont = EnumValues<typeof HudFontValues>

export type HudTextSize = {
  readonly width: number
  readonly height: number
}

// FUN_00408be0: how large the font draws a string, in the font's own pixels. The fonts are built from
// `FONT_THS.BMP` and `IGNUM.BMP` by code that is not ported, so the caller measures with whatever it draws with.
export type HudMeasureText = (font: HudFont, text: string) => HudTextSize

export type HudImageSize = {
  readonly width: number
  readonly height: number
}

// The HUD object (race +0x283c, stride 0x140; initialize 0x00425d80, layout 0x00425e90 and 0x004261f0), mode 1.
export type HudLayout = {
  // +0xfc, +0x100.
  readonly screenWidth: number
  readonly screenHeight: number
  // +0x10c and +0x114: pixels per 640 × 480 design pixel.
  readonly horizontalScale: number
  readonly verticalScale: number
  // +0xe4: width of the shortest time string; +0xe8: width of the longest.
  readonly shortTimeWidth: number
  readonly longTimeWidth: number
  // +0xa4: screen centre; +0xa8: a tenth of the way across.
  readonly centerX: number
  readonly positionX: number
  // +0xac (= +0xb0 = +0xb4 = +0xbc): left edge of the time column.
  readonly timeColumnX: number
  // +0xb8: where the wrong-way text starts.
  readonly wrongWayX: number
  // +0xc0: the power-up holder's left edge.
  readonly holderX: number
  // +0xc4, +0xc8 (= +0xcc), +0xd0, +0xd4 (= +0xc4), +0xd8, +0xdc, +0xe0: rows.
  readonly countdownY: number
  readonly firstRowY: number
  readonly secondRowY: number
  readonly thirdRowY: number
  readonly gapRowY: number
  readonly wrongWayY: number
  readonly holderY: number
}

export type HudLayoutParameters = {
  readonly screenWidth: number
  readonly screenHeight: number
  readonly measureText: HudMeasureText
  readonly getString: (stringId: number) => string
  // The size of the power-up holder image (image database entry 0xb).
  readonly holderSize: HudImageSize
}

export type HudTextCommand = {
  readonly kind: 'text'
  readonly text: string
  readonly font: HudFont
  readonly x: number
  readonly y: number
  readonly scaleX: number
  readonly scaleY: number
  // 0xAARRGGBB, or null for the font's own colour (white).
  readonly color: number | null
}

export type HudImageCommand = {
  readonly kind: 'image'
  // The image database entry (LEGOIMGS.IDB) and its name.
  readonly imageIndex: number
  readonly imageName: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: number | null
}

export type HudCommand = HudTextCommand | HudImageCommand

// What the HUD object remembers between frames.
export type HudState = {
  // +0x70: milliseconds since the countdown began (positive), 0 when idle, negative after the finish.
  readonly countdownMilliseconds: number
  // +0x74: milliseconds into the place number's pop; 0 when idle.
  readonly popMilliseconds: number
  // +0x7c: the lap whose text is shown; -1 before the first.
  readonly shownLap: number
  // +0x88: the best lap time; 0 before a lap is done.
  readonly bestLapMilliseconds: number
  // +0x8c: the place to show after the finish (racer place - 1); -1 follows the racer.
  readonly placeOverride: number
  // +0x90: the place shown (0 is first, 8 hides it).
  readonly shownPlace: number
  // The strings the original keeps in the object: +0x61 lap, +0x3d current lap time, +0x46 best lap time,
  // +0x58 total time.
  readonly lapText: string
  readonly currentTimeText: string
  readonly bestTimeText: string
  readonly totalTimeText: string
}

export type HudHeldPowerUp = {
  // Racer +0xccc: 1 projectile, 2 shield, 3 turbo, 4 hazard; 0 none.
  readonly kindCode: number
  // Racer +0xd58.
  readonly level: number
}

// What 0x004263a0 reads from the HUD's racer.
export type HudRacerView = {
  // +0xce4, +0xce0 and +0xcec.
  readonly currentLap: number
  readonly lapCount: number
  readonly lapMilliseconds: readonly number[]
  // +0xd00 (1 = first).
  readonly racePosition: number
  // +0xd04 & 0x4000, & 0x10.
  readonly isWrongWay: boolean
  readonly isWarping: boolean
  readonly heldPowerUp: HudHeldPowerUp
}

export type HudInput = {
  readonly frameMilliseconds: number
  readonly layout: HudLayout
  readonly racer: HudRacerView
  // GAME.SRF string by id.
  readonly getString: (stringId: number) => string
  // The image database's names, in entry order (LEGOIMGS.IDB).
  readonly imageNames: readonly string[]
  readonly getImageSize: (imageName: string) => HudImageSize | null
  readonly measureText: HudMeasureText
}

export type HudFrame = {
  readonly state: HudState
  readonly commands: readonly HudCommand[]
  // Sound ids (GENERAL.SBK entries) the frame plays.
  readonly soundIds: readonly number[]
}

export type HudPoint = {
  readonly x: number
  readonly y: number
}

export type HudScale = HudPoint

export type HudHeldKindIcon = {
  readonly imageBase: number
  readonly color: number
}

export type HudCountdown = {
  readonly state: HudState
  readonly commands: HudCommand[]
  readonly soundIds: number[]
}

export type HudLapTexts = Pick<
  HudState,
  | 'lapText'
  | 'currentTimeText'
  | 'bestTimeText'
  | 'totalTimeText'
  | 'bestLapMilliseconds'
  | 'shownLap'
> & { readonly isTimeShown: boolean }
