import type { BuilderHistory, BuilderPart } from '../../types/building.types.ts'

const MAXIMUM_STEPS = 500

export const createBuilderHistory = (parts: readonly BuilderPart[]): BuilderHistory =>
  Object.freeze({ past: Object.freeze([]), present: parts, future: Object.freeze([]) })

// A change: the present becomes undoable and what was undone is gone.
export const pushBuilderHistory = (
  history: BuilderHistory,
  parts: readonly BuilderPart[]
): BuilderHistory =>
  Object.freeze({
    past: Object.freeze([...history.past, history.present].slice(-MAXIMUM_STEPS)),
    present: parts,
    future: Object.freeze([]),
  })

export const undoBuilderHistory = (history: BuilderHistory): BuilderHistory => {
  const previous = history.past.at(-1)
  return previous === undefined
    ? history
    : Object.freeze({
        past: Object.freeze(history.past.slice(0, -1)),
        present: previous,
        future: Object.freeze([history.present, ...history.future]),
      })
}

export const redoBuilderHistory = (history: BuilderHistory): BuilderHistory => {
  const next = history.future[0]
  return next === undefined
    ? history
    : Object.freeze({
        past: Object.freeze([...history.past, history.present]),
        present: next,
        future: Object.freeze(history.future.slice(1)),
      })
}
