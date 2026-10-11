const ENGLISH_LANGUAGE_INDEX = 0

// FUN_0042f0b0: the registry value `LangID` under HKLM\Software\LEGO Media\Games\LEGO Racers\0.90.000 (0 when absent
// or not a dword) maps to the index of the game's language list (english is 0; MENUDATA\<language> holds the others).
const LANGUAGE_INDICES_BY_IDENTIFIER: ReadonlyMap<number, number> = new Map([
  [0x1d, 6],
  [0x06, 5],
  [0x07, 3],
  [0x0a, 1],
  [0x0b, 10],
  [0x10, 4],
  [0x13, 8],
  [0x14, 7],
  [0x40c, 2],
])

export const getLanguageIndex = (languageIdentifier: number): number =>
  LANGUAGE_INDICES_BY_IDENTIFIER.get(languageIdentifier) ?? ENGLISH_LANGUAGE_INDEX
