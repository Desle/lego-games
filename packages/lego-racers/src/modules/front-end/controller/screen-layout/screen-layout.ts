import type { MenuEntry, MenuFile, MenuProperty, MenuValue } from '../../../menu-file/index.ts'
import type { FrontEndRectangle } from '../../types/front-end.types.ts'
import type { ItemPosition, ItemSize } from '../../types/front-end-widget.types.ts'

const NAME_LENGTH = 8

// The keywords of the position block `{ ... }` of an item (0x00469a20).
const POSITION_BLOCK_KEYWORD = 0x36
const RECTANGLE_KEYWORD = 0x2f
const PARENT_KEYWORD = 0x31

// FUN_004119a0: the name table looks names up over eight characters.
const getKey = (name: string) => name.slice(0, NAME_LENGTH)

export const findEntry = (file: MenuFile, name: string): MenuEntry | null => {
  const key = getKey(name)
  for (const section of file.sections) {
    const entry = section.entries.find((candidate) => getKey(candidate.name) === key)
    if (entry !== undefined) return entry
  }
  return null
}

export const getProperty = (
  properties: readonly MenuProperty[],
  keyword: number
): MenuProperty | null => properties.find((property) => property.keyword === keyword) ?? null

export const getPropertyValues = (entry: MenuEntry, keyword: number): readonly MenuValue[] | null =>
  getProperty(entry.properties, keyword)?.values ?? null

// The position block of an entry: the entry's own properties for a fill (section 0x37), else the nested 0x36.
const getPositionBlock = (entry: MenuEntry): readonly MenuProperty[] =>
  getProperty(entry.properties, POSITION_BLOCK_KEYWORD)?.block ?? entry.properties

export const getItemPosition = (entry: MenuEntry): ItemPosition => {
  const block = getPositionBlock(entry)
  const rectangle = getProperty(block, RECTANGLE_KEYWORD)?.values ?? [0, 0, 0, 0]
  const parent = getProperty(block, PARENT_KEYWORD)?.values[0]
  return Object.freeze({
    rectangle: [
      Number(rectangle[0] ?? 0),
      Number(rectangle[1] ?? 0),
      Number(rectangle[2] ?? 0),
      Number(rectangle[3] ?? 0),
    ] as const,
    parentName: typeof parent === 'string' ? parent : null,
  })
}

// LEGORacers.exe 0x00472e90 adds the left and top of every ancestor, 0x0046f150 gives an item with a zero right or
// bottom its image's size. `ownSize` is that size (the image's, or the text's).
export const getAbsoluteRectangle = (
  file: MenuFile,
  entry: MenuEntry,
  ownSize: ItemSize,
  originX = 0,
  originY = 0
): FrontEndRectangle => {
  const position = getItemPosition(entry)
  const [left, top, right, bottom] = position.rectangle
  let parentLeft = originX
  let parentTop = originY
  let parentName = position.parentName
  const visited = new Set<string>()
  while (parentName !== null && !visited.has(parentName)) {
    visited.add(parentName)
    const parent = findEntry(file, parentName)
    if (parent === null) break
    const parentPosition = getItemPosition(parent)
    parentLeft += parentPosition.rectangle[0]
    parentTop += parentPosition.rectangle[1]
    parentName = parentPosition.parentName
  }
  return Object.freeze({
    left: parentLeft + left,
    top: parentTop + top,
    right: parentLeft + (right === 0 ? left + ownSize.width : right),
    bottom: parentTop + (bottom === 0 ? top + ownSize.height : bottom),
  })
}
