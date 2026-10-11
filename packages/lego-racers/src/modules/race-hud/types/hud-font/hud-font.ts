import { createEnum } from '../../../../shared/types/enum.types.ts'

// The two fonts Hud_Initialize 0x00425d80 looks up in the font database by name (hud +0x20 and +0x24).
export const HudFont = createEnum({
  // `font_ths`: lap, time and label text.
  TEXT: 'text',
  // `ignum`: the large numerals of the countdown, the place and the finish text.
  DIGITS: 'digits',
})
