import {
  blockOf,
  countedIntegers,
  createBlockGrammar,
  createSectionGrammar,
  integers,
  strings,
} from '../../controller/menu-grammar-builders/menu-grammar-builders.ts'
import type { MenuFileGrammar } from '../menu-file.types.ts'

// The keywords of a menu styles file (`.MSB`), read by LEGORacers.exe 0x0046b130 (root), 0x0046fd80 (sections),
// 0x00480740 (the button styles of GSTYLES.MSB) and the style readers 0x0046fe20 .. 0x00470dc0. The names are this
// port's (hypothesis for the roles).
export const MenuStylesKeyword = Object.freeze({
  FILE: 0x27,
  IMAGE_STYLE: 0x32,
  FONT_STYLE: 0x33,
  FRAME_STYLE: 0x34,
  ARROW_STYLE: 0x35,
  TABLE_STYLE: 0x36,
  LIST_STYLE: 0x37,
  PICKER_STYLE: 0x38,
  CONTAINER_STYLE: 0x39,
  CHOOSER_STYLE: 0x3b,
  TEXT_STYLE: 0x3d,
  BUTTON_STYLE: 0x3e,
  STYLE_BLOCK: 0x3a,
})

// 0x00470020: colours of six states, a five-short record, six rectangles and a number.
const styleBlock = createBlockGrammar([
  [0x2a, integers(24)],
  [0x2b, integers(5)],
  [0x2c, integers(24)],
  [0x2d, integers(1)],
])

const styled = [0x3a, blockOf(styleBlock)] as const

const sections = [
  // 0x0046fe20
  createSectionGrammar(
    0x32,
    createBlockGrammar([
      [0x28, strings(1)],
      [0x2a, integers(4)],
    ])
  ),
  // 0x0046feb0
  createSectionGrammar(
    0x33,
    createBlockGrammar([
      [0x29, strings(1)],
      [0x2a, integers(4)],
      [0x2e, integers(1)],
      [0x2f, integers(1)],
    ])
  ),
  // 0x0046ff70
  createSectionGrammar(
    0x34,
    createBlockGrammar([
      [0x28, strings(8)],
      [0x2a, integers(8)],
    ])
  ),
  // 0x00470110
  createSectionGrammar(0x35, createBlockGrammar([[0x28, strings(6)], styled])),
  // 0x004701a0: exactly three 0x28 columns.
  createSectionGrammar(
    0x36,
    createBlockGrammar([[0x28, strings(6)], [0x29, strings(6)], [0x2c, integers(4)], styled]),
    { exact: [[0x28, 3]] }
  ),
  // 0x004702e0: 0x30 and 0x31 read as many items as 0x2f announced.
  createSectionGrammar(
    0x37,
    createBlockGrammar([
      [0x28, strings(1)],
      [0x2f, integers(1)],
      [0x30, countedIntegers(0x2f, 4, false)],
      [0x31, countedIntegers(0x2f, 1, false)],
      styled,
    ])
  ),
  // 0x00470410
  createSectionGrammar(
    0x38,
    createBlockGrammar([
      [0x2b, integers(3)],
      [0x2d, integers(1)],
      [0x2f, integers(2)],
    ])
  ),
  // 0x004704b0: one box style, two arrow styles and a style block are required.
  createSectionGrammar(
    0x39,
    createBlockGrammar([[0x2a, integers(32)], [0x34, strings(1)], [0x35, strings(2)], styled]),
    {
      minimum: [
        [0x34, 1],
        [0x35, 1],
        [0x3a, 1],
      ],
    }
  ),
  // 0x00470650
  createSectionGrammar(
    0x3b,
    createBlockGrammar([
      [0x28, strings(6)],
      [0x2b, integers(2)],
      [0x32, strings(2)],
      [0x35, strings(2)],
      styled,
    ]),
    {
      minimum: [
        [0x32, 1],
        [0x35, 1],
        [0x3a, 1],
      ],
    }
  ),
  // 0x00470dc0: the section is 0x3d, its entries open with 0x3a and the body is the style block itself.
  createSectionGrammar(0x3a, styleBlock),
  // 0x004808f0 / 0x00480760: the button styles that GSTYLES.MSB adds.
  createSectionGrammar(
    0x3e,
    createBlockGrammar([
      [0x28, strings(6)],
      [0x29, strings(6)],
      [0x2a, integers(52)],
      [0x2c, integers(8)],
      [0x2e, integers(1)],
      styled,
    ])
  ),
]

// A section is introduced by its own keyword except the text styles: section 0x3d holds entries that open with 0x3a.
const getSectionKeyword = (entryKeyword: number): number =>
  entryKeyword === 0x3a ? 0x3d : entryKeyword

export const MENU_STYLES_GRAMMAR: MenuFileGrammar = Object.freeze({
  sections: new Map(sections.map((section) => [getSectionKeyword(section.entryKeyword), section])),
})
