import { getIsChampionBeaten } from '../../../ghost/index.ts'
import { HudFont } from '../../../race-hud/index.ts'
import type { HudCommand } from '../../../race-hud/index.ts'
import { PauseMenuMode } from '../../../race/index.ts'
import type { HudContext } from '../../types/race-presentation.types.ts'
import type { MenuRaceState, MenuTexts } from './get-pause-menu-commands.types.ts'

// GAME.SRF string ids of the menus: the lists at 0x004bee74 (paused, no points record), 0x004bee7c (paused in a circuit),
// 0x004bee84 (results and confirmation), the titles and subtitles 0x00436010 passes.
const PAUSED_ITEMS = Object.freeze([0x0e, 0x0f, 0x11])
const PAUSED_CIRCUIT_ITEMS = Object.freeze([0x0e, 0x10, 0x11])
const ANSWER_ITEMS = Object.freeze([0x12, 0x13])
const PAUSED_TITLE = 0x14
const NOT_BEATEN_TITLE = 0x15
const NOT_BEATEN_SUBTITLE = 0x16
const BEATEN_TITLE = 0x17
const BEATEN_SUBTITLE = 0x18
const CONFIRMATION_TITLE = 0x2c

// 0x00427440: the title is white, an item is dark teal and the selected one bright cyan.
const TITLE_COLOR = 0xffffffff
const ITEM_COLOR = 0xff127f7f
const SELECTED_COLOR = 0xff24ffff
// 0x004276c0: a black quad over the whole surface at alpha 0x40.
const DIMMER_COLOR = 0x40000000
// 0x00427440 draws the selected item only while the blink timer is below 250 ms.
const BLINK_VISIBLE_MILLISECONDS = 250
const NO_COMMANDS: readonly HudCommand[] = Object.freeze([])

// 0x00436010: what each menu mode shows.
const getMenuTexts = (raceState: MenuRaceState): MenuTexts | null => {
  const { mode } = raceState.pauseMenu
  if (mode === PauseMenuMode.PAUSED) {
    return {
      title: PAUSED_TITLE,
      subtitle: null,
      items: raceState.pointsRecord === null ? PAUSED_ITEMS : PAUSED_CIRCUIT_ITEMS,
    }
  }
  if (mode === PauseMenuMode.RESULTS) {
    const isBeaten = raceState.ghost !== null && getIsChampionBeaten(raceState.ghost)
    return {
      title: isBeaten ? BEATEN_TITLE : NOT_BEATEN_TITLE,
      subtitle: isBeaten ? BEATEN_SUBTITLE : NOT_BEATEN_SUBTITLE,
      items: ANSWER_ITEMS,
    }
  }
  if (mode === PauseMenuMode.CONFIRMATION) {
    return { title: CONFIRMATION_TITLE, subtitle: null, items: ANSWER_ITEMS }
  }
  return null
}

// The menu widget's draw (race +0x3058, 0x00427440) and its layout (0x00427310): a dimmed screen, the title (and the
// ghost result's second line) centred, and the items below it, centred on the screen's middle, one line apart. The font
// is the HUD's text font (race `+0x2d7c`, **hypothesis**: the value was not traced to `Hud_Initialize`).
export const getPauseMenuCommands = (
  raceState: MenuRaceState,
  context: HudContext
): readonly HudCommand[] => {
  const texts = getMenuTexts(raceState)
  if (texts === null) return NO_COMMANDS
  const { screenWidth, screenHeight } = context.layout
  const { selection, blinkMilliseconds, isAnswered } = raceState.pauseMenu
  const itemTexts = texts.items.map((stringId) => context.getString(stringId))
  const lineHeight =
    Math.max(...itemTexts.map((text) => context.measureText(HudFont.TEXT, text).height)) + 2
  const firstItemY = (screenHeight >> 1) - ((itemTexts.length * lineHeight) >> 1)
  const getCentredText = (text: string, y: number, color: number): HudCommand => ({
    kind: 'text',
    text,
    font: HudFont.TEXT,
    x: (screenWidth >> 1) - (context.measureText(HudFont.TEXT, text).width >> 1),
    y,
    scaleX: 1,
    scaleY: 1,
    color,
  })
  const isSubtitleShown = texts.subtitle !== null
  const titleY = firstItemY - lineHeight - (isSubtitleShown ? lineHeight >> 1 : 0)
  const heading: HudCommand[] = [
    getCentredText(context.getString(texts.title), titleY, TITLE_COLOR),
  ]
  if (texts.subtitle !== null) {
    heading.push(
      getCentredText(context.getString(texts.subtitle), titleY + lineHeight, TITLE_COLOR)
    )
  }
  const itemsTop = titleY + lineHeight * (isSubtitleShown ? 2 : 1)
  const items = itemTexts.flatMap((text, index): readonly HudCommand[] => {
    const y = itemsTop + index * lineHeight
    const isSelected = index === selection && !isAnswered
    if (!isSelected) return [getCentredText(text, y, ITEM_COLOR)]
    return blinkMilliseconds < BLINK_VISIBLE_MILLISECONDS
      ? [getCentredText(text, y, SELECTED_COLOR)]
      : []
  })
  return [
    { kind: 'fill', x: 0, y: 0, width: screenWidth, height: screenHeight, color: DIMMER_COLOR },
    ...heading,
    ...items,
  ]
}
