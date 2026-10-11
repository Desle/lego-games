// The HUD's two fonts are bitmap fonts of the race's language folder: `font_ths` for the lap and time text and
// `ignum` for the numerals (Hud_Initialize 0x00425d80 looks both up in LEGOFNTS.FDB by these names). Keys are the
// HudFont values.
export const HUD_FONT_NAMES: Readonly<Record<string, string>> = Object.freeze({
  text: 'font_ths',
  digits: 'ignum',
})
