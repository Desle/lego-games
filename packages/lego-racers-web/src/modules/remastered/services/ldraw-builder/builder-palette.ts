import { COMMON_PART_GROUPS } from './common-parts.ts'
import type { LibraryPart, PaletteGroup } from './ldraw-builder.types.ts'

const MAXIMUM_RESULTS = 60

const getNumber = (name: string): string => name.replace(/\.dat$/i, '').toLowerCase()

// What the palette lists: the shortlist (the parts the library has) when nothing is typed, else the parts whose number begins with
// the text or whose description has every word of it, numbers first.
export const USED_GROUP_LABEL = 'Used'

// The shortlist leads with a Used tab: the parts of the model being built, the latest placed first.
export const getPaletteGroups = (
  parts: readonly LibraryPart[],
  query: string,
  usedPartNames: readonly string[] = []
): readonly PaletteGroup[] => {
  const text = query.trim().toLowerCase()
  if (text === '') {
    const byNumber = new Map(parts.map((part) => [getNumber(part.name), part]))
    const used = [...new Set(usedPartNames.map(getNumber).reverse())].flatMap((number) => {
      const part = byNumber.get(number)
      return part === undefined ? [] : [part]
    })
    const usedGroups = used.length === 0 ? [] : [{ label: USED_GROUP_LABEL, parts: used }]
    return [
      ...usedGroups,
      ...COMMON_PART_GROUPS.map((group) => ({
        label: group.label,
        parts: group.partNames.flatMap((name) => {
          const part = byNumber.get(name)
          return part === undefined ? [] : [part]
        }),
      })),
    ]
  }
  const words = text.split(/\s+/)
  const byPrefix = parts.filter((part) => getNumber(part.name).startsWith(text))
  const byWords = parts.filter(
    (part) =>
      !byPrefix.includes(part) &&
      words.every((word) => part.description.toLowerCase().includes(word))
  )
  const found = [...byPrefix, ...byWords]
  return [
    {
      label: `${String(found.length)} found${found.length > MAXIMUM_RESULTS ? ` (first ${String(MAXIMUM_RESULTS)})` : ''}`,
      parts: found.slice(0, MAXIMUM_RESULTS),
    },
  ]
}
