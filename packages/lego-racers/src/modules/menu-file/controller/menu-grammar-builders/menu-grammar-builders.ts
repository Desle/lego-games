import type {
  MenuBlockGrammar,
  MenuOperandKind,
  MenuPropertyGrammar,
  MenuSectionGrammar,
  MenuSectionCounts,
} from '../../types/menu-file.types.ts'

export const repeatOperand = (kind: MenuOperandKind, count: number): readonly MenuOperandKind[] =>
  Array.from({ length: count }, () => kind)

export const operands = (...kinds: readonly MenuOperandKind[]): MenuPropertyGrammar =>
  Object.freeze({ kind: 'operands', operands: kinds })

export const integers = (count: number): MenuPropertyGrammar =>
  operands(...repeatOperand('integer', count))

export const strings = (count: number): MenuPropertyGrammar =>
  operands(...repeatOperand('string', count))

export const floats = (count: number): MenuPropertyGrammar =>
  operands(...repeatOperand('float', count))

export const blockOf = (block: MenuBlockGrammar): MenuPropertyGrammar =>
  Object.freeze({ kind: 'block', block })

export const countedIntegers = (
  countKeyword: number,
  integersPerItem: number,
  isZeroCountFatal: boolean
): MenuPropertyGrammar =>
  Object.freeze({ kind: 'counted', countKeyword, integersPerItem, isZeroCountFatal })

export const createBlockGrammar = (
  properties: readonly (readonly [number, MenuPropertyGrammar])[],
  fallback: MenuBlockGrammar | null = null
): MenuBlockGrammar => Object.freeze({ properties: new Map(properties), fallback })

export const createSectionGrammar = (
  entryKeyword: number,
  body: MenuBlockGrammar,
  counts: MenuSectionCounts = {}
): MenuSectionGrammar =>
  Object.freeze({
    entryKeyword,
    body,
    minimumCounts: new Map(counts.minimum ?? []),
    exactCounts: new Map(counts.exact ?? []),
  })
