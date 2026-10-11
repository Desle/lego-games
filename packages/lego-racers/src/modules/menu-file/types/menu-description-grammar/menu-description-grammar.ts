import {
  blockOf,
  countedIntegers,
  createBlockGrammar,
  createSectionGrammar,
  floats,
  integers,
  operands,
  strings,
} from '../../controller/menu-grammar-builders/menu-grammar-builders.ts'
import type { MenuFileGrammar } from '../menu-file.types.ts'

// The keywords of a menu description (`.MIB`), read by LEGORacers.exe 0x0046b130 (root), 0x00469950 (sections)
// and the item readers 0x00469a20 .. 0x0046af50. The section names are this port's; the original has only the
// reader functions (hypothesis for the roles).
export const MenuDescriptionKeyword = Object.freeze({
  FILE: 0x27,
  // Section keywords (also the keyword of each entry in the section).
  FILL: 0x37,
  IMAGE: 0x38,
  TEXT: 0x39,
  FRAME: 0x3a,
  ARROW: 0x3b,
  TABLE: 0x3c,
  CHOOSER_PARTS: 0x3d,
  CHOOSER: 0x3e,
  LIST: 0x3f,
  CONTROL: 0x40,
  VIEWPORT: 0x42,
  SELECTOR: 0x43,
  SOUND: 0x45,
  BUTTON: 0x46,
  // Properties.
  IMAGE_NAME: 0x28,
  COLORS: 0x2a,
  RECTANGLE: 0x2f,
  PARENT: 0x31,
  POSITION_BLOCK: 0x36,
})

// 0x00469a20: the position block `{ ... }` of an item.
const positionBlock = createBlockGrammar([
  [0x2a, integers(4)],
  [0x2f, integers(4)],
  [0x30, integers(1)],
  [0x31, strings(1)],
  [0x32, integers(1)],
])

// 0x00469b50: the properties most items share.
const commonProperties = createBlockGrammar([
  [0x2a, integers(24)],
  [0x2b, integers(5)],
  [0x2c, integers(1)],
  [0x31, strings(1)],
  [0x32, integers(1)],
  [0x33, integers(1)],
  [0x34, integers(1)],
  [0x36, blockOf(positionBlock)],
])

const withCommon = (properties: Parameters<typeof createBlockGrammar>[0]) =>
  createBlockGrammar(properties, commonProperties)

// 0x00469fd0: an item that carries six image names, otherwise the common properties.
const arrowBody = withCommon([[0x28, strings(6)]])

// The nested `0x36 { ... }` of the sections without the common fallback.
const positioned = [0x36, blockOf(positionBlock)] as const

const sections = [
  // 0x0046a750: the entry body is the position block itself.
  createSectionGrammar(0x37, positionBlock),
  // 0x00469d90
  createSectionGrammar(
    0x38,
    createBlockGrammar([[0x28, strings(1)], [0x2a, integers(4)], positioned])
  ),
  // 0x00469e20: 0x29 reads an image name and then, falling into 0x2a, a colour.
  createSectionGrammar(
    0x39,
    createBlockGrammar([
      [0x29, operands('string', 'integer', 'integer', 'integer', 'integer')],
      [0x2a, integers(4)],
      [0x33, integers(1)],
      positioned,
    ])
  ),
  // 0x00469ee0
  createSectionGrammar(
    0x3a,
    createBlockGrammar([[0x28, strings(8)], [0x2a, integers(8)], [0x33, integers(1)], positioned])
  ),
  // 0x00469fd0
  createSectionGrammar(0x3b, arrowBody),
  // 0x0046a050: 0x28 can repeat, one column of six names each.
  createSectionGrammar(
    0x3c,
    withCommon([
      [0x28, strings(6)],
      [0x29, strings(6)],
    ])
  ),
  // 0x0046a110
  createSectionGrammar(
    0x3d,
    withCommon([
      [0x28, strings(1)],
      [0x3b, blockOf(arrowBody)],
    ])
  ),
  // 0x0046a190
  createSectionGrammar(
    0x3e,
    withCommon([
      [0x33, integers(1)],
      [0x3a, strings(1)],
      [0x3b, strings(2)],
    ])
  ),
  // 0x0046a1f0: 0x2f reads as many rectangles as 0x33 announced (fatal when it announced none).
  createSectionGrammar(
    0x3f,
    createBlockGrammar([
      [0x2e, floats(9)],
      [0x2f, countedIntegers(0x33, 4, true)],
      [0x33, operands('integer', 'integer', 'float')],
      positioned,
    ])
  ),
  // 0x0046a310
  createSectionGrammar(
    0x40,
    withCommon([
      [0x28, strings(6)],
      [0x2b, integers(7)],
      [0x33, integers(2)],
      [0x38, strings(2)],
      [0x3b, strings(2)],
    ])
  ),
  // 0x0046a490
  createSectionGrammar(
    0x42,
    createBlockGrammar([
      [0x2d, strings(1)],
      [0x2e, floats(9)],
      [0x33, integers(2)],
      [0x35, integers(1)],
      [0x3a, strings(1)],
      positioned,
    ])
  ),
  // 0x0046a640
  createSectionGrammar(
    0x43,
    withCommon([
      [0x29, strings(1)],
      [0x2b, integers(9)],
      [0x33, integers(1)],
    ])
  ),
  // 0x0046a590
  createSectionGrammar(
    0x45,
    createBlockGrammar([[0x2d, strings(1)], [0x33, integers(2)], positioned])
  ),
]

// 0x0047f2b0, reached through the screen base class's reader 0x0047f290 for keyword 0x46: a button carries six
// image names, six font names and thirteen colours of its own, and the common properties.
const buttonSection = createSectionGrammar(
  0x46,
  withCommon([
    [0x28, strings(6)],
    [0x29, strings(6)],
    [0x2a, integers(52)],
    [0x33, integers(1)],
  ])
)

export const MENU_DESCRIPTION_GRAMMAR: MenuFileGrammar = Object.freeze({
  sections: new Map([...sections, buttonSection].map((section) => [section.entryKeyword, section])),
})
