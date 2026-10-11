import type { FontWord } from './font-emulator-fixtures.types.ts'
import type { EmulatorBuffer } from '../../../../shared/emulator/emulator-client.types.ts'
import type { SeededRandom } from '../../../../shared/emulator/seeded-random.types.ts'
import type { BitmapFont } from '../../types/font-rendering.types.ts'
import type { FontCase } from './font-emulator-fixtures.types.ts'

const SPACE_CODE = 0x20
const SCALE_CHOICES: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 1.8, 2, 2.5, 3].map(Math.fround)
const LINE_BREAKS: readonly number[] = [0x0a, 0x0d]

export const getUnsignedWord = (value: number): number => value >>> 0

const getSortedCodes = (random: SeededRandom): readonly number[] => {
  const codes = new Set<number>([SPACE_CODE])
  const count = 3 + random.nextIntegerBelow(18)
  while (codes.size < count) codes.add(1 + random.nextIntegerBelow(300))
  return [...codes].sort((left, right) => left - right)
}

export const getFontCase = (random: SeededRandom): FontCase => {
  const glyphs = getSortedCodes(random).map((code) => ({
    code,
    imageX: random.nextIntegerBelow(500),
    width: 1 + random.nextIntegerBelow(30),
  }))
  const font: BitmapFont = {
    name: 'case',
    lineHeight: 8 + random.nextIntegerBelow(60),
    spaceWidth: 2 + random.nextIntegerBelow(12),
    letterSpacing: random.nextIntegerBelow(7) - 3,
    glyphs,
    colorKey: null,
    tint: [255, 255, 255],
    imageWidth: 600,
  }
  const alphabet = [...glyphs.map((glyph) => glyph.code), ...LINE_BREAKS, 301, 999]
  const length = random.nextIntegerBelow(60)
  const text = Array.from({ length }, () => {
    if (random.nextIntegerBelow(10) < 2) return SPACE_CODE
    return alphabet[random.nextIntegerBelow(alphabet.length)] ?? SPACE_CODE
  })
  return {
    font,
    text,
    maximumWidth: 20 + random.nextIntegerBelow(300),
    firstLineOffset: random.nextIntegerBelow(21) - 10,
    scaleX: SCALE_CHOICES[random.nextIntegerBelow(SCALE_CHOICES.length)] ?? 1,
    scaleY: SCALE_CHOICES[random.nextIntegerBelow(SCALE_CHOICES.length)] ?? 1,
    probeCode: random.nextIntegerBelow(320),
  }
}

// The font object (page count +4, spacing +0x18, height +0x1c, letter spacing +0x20, count +0x24, glyphs +0x28), its glyph table,
// and the wide string object 0x00449e10 builds (characters +0, start +6, end +8; two 16-bit characters per word).
export const getFontBuffers = (
  fontCase: FontCase,
  fontWords: readonly FontWord[]
): readonly EmulatorBuffer[] => {
  const { font, text } = fontCase
  const characterWords: number[] = []
  for (let index = 0; index < text.length + 4; index += 2) {
    characterWords.push((text[index] ?? 0) | ((text[index + 1] ?? 0) << 16))
  }
  return [
    {
      name: 'font',
      words: [
        fontWords[0] ?? 0,
        1,
        0,
        0,
        0,
        0,
        font.spaceWidth,
        font.lineHeight,
        getUnsignedWord(font.letterSpacing),
        font.glyphs.length,
        { buffer: 'glyphs' },
        fontWords[1] ?? 0,
      ],
      isRead: false,
    },
    {
      name: 'glyphs',
      words: font.glyphs.flatMap((glyph) => [
        glyph.code | (glyph.imageX << 16),
        glyph.imageX << 16,
        glyph.width << 16,
      ]),
      isRead: false,
    },
    { name: 'text', words: [{ buffer: 'characters' }, 0, text.length], isRead: false },
    { name: 'characters', words: characterWords, isRead: false },
    { name: 'output', size: 8, isRead: true },
  ]
}
