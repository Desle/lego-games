import { MENU_DESCRIPTION_GRAMMAR } from './types/menu-description-grammar/menu-description-grammar.ts'
import { MENU_STYLES_GRAMMAR } from './types/menu-styles-grammar/menu-styles-grammar.ts'
import { parseMenuFile } from './controller/parse-menu-file/parse-menu-file.ts'
import type { MenuFile } from './types/menu-file.types.ts'

// LEGORacers.exe 0x0046b890: a menu description (`.MIB`) and its styles (`.MSB`) share one reader.
export const parseMenuDescription = (bytes: Uint8Array): MenuFile =>
  parseMenuFile(bytes, MENU_DESCRIPTION_GRAMMAR)
export const parseMenuStyles = (bytes: Uint8Array): MenuFile =>
  parseMenuFile(bytes, MENU_STYLES_GRAMMAR)
export { parseMenuFile } from './controller/parse-menu-file/parse-menu-file.ts'
export { MenuDescriptionKeyword } from './types/menu-description-grammar/menu-description-grammar.ts'
export { MenuStylesKeyword } from './types/menu-styles-grammar/menu-styles-grammar.ts'
export type {
  MenuBlockGrammar,
  MenuEntry,
  MenuFile,
  MenuFileGrammar,
  MenuProperty,
  MenuSection,
  MenuValue,
} from './types/menu-file.types.ts'
