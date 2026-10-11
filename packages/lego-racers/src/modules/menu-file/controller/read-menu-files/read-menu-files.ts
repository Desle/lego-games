import type { MenuFile } from '../../types/menu-file.types.ts'
import { MENU_DESCRIPTION_GRAMMAR } from '../menu-description-grammar/menu-description-grammar.ts'
import { MENU_STYLES_GRAMMAR } from '../menu-styles-grammar/menu-styles-grammar.ts'
import { parseMenuFile } from '../parse-menu-file/parse-menu-file.ts'

// LEGORacers.exe 0x0046b890: a menu description (`.MIB`) and its styles (`.MSB`) share one reader.
export const parseMenuDescription = (bytes: Uint8Array): MenuFile =>
  parseMenuFile(bytes, MENU_DESCRIPTION_GRAMMAR)
export const parseMenuStyles = (bytes: Uint8Array): MenuFile =>
  parseMenuFile(bytes, MENU_STYLES_GRAMMAR)
