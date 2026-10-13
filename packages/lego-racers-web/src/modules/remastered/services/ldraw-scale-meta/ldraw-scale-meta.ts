import type { BuilderDocument } from '@lego-games/ldraw/building'

// `0 !RACERS SCALE <factor>`: the size a power-up object's or a particle's file is drawn at, relative to the frame the builder shows
// it in (powerup-object-frame.ts). One line per file, kept after the header; a file without one is fitted.
const SCALE_META = /^0\s+!RACERS\s+SCALE\s+(\S+)\s*$/i
const SCALE_DECIMALS = 4

const getIsScaleLine = (line: string): boolean => SCALE_META.test(line.trim())

const getScale = (line: string): number | null => {
  const value = Number(SCALE_META.exec(line.trim())?.[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

export const formatScaleLine = (scale: number): string =>
  `0 !RACERS SCALE ${String(Number(scale.toFixed(SCALE_DECIMALS)))}`

// The file's scale, null when it has no (valid) scale line.
export const getModelFileScale = (text: string): number | null => {
  for (const line of text.split(/\r?\n/)) {
    const scale = getIsScaleLine(line) ? getScale(line) : null
    if (scale !== null) return scale
  }
  return null
}

const withoutScaleLines = (lines: readonly string[]): readonly string[] =>
  Object.freeze(lines.filter((line) => !getIsScaleLine(line)))

// The document without its scale line, wherever the parse kept it (after the header it is the first part's comment).
export const removeScaleMeta = (document: BuilderDocument): BuilderDocument =>
  Object.freeze({
    headerLines: withoutScaleLines(document.headerLines),
    referenceLines: withoutScaleLines(document.referenceLines),
    parts: Object.freeze(
      document.parts.map((part) =>
        Object.freeze({ ...part, commentLines: withoutScaleLines(part.commentLines) })
      )
    ),
    keptLines: withoutScaleLines(document.keptLines),
  })

// The document with the one scale line last in its header (null: none, the file is fitted).
export const setScaleMeta = (document: BuilderDocument, scale: number | null): BuilderDocument => {
  const cleared = removeScaleMeta(document)
  return Object.freeze({
    ...cleared,
    headerLines: Object.freeze([
      ...cleared.headerLines,
      ...(scale === null ? [] : [formatScaleLine(scale)]),
    ]),
  })
}
