// What a value in a menu file is: the tokens an item property reads are integers, floats and strings.
export type MenuOperandKind = 'integer' | 'float' | 'string'

export type MenuValue = number | string

// A property of an item: its keyword, the values that follow it and, for a property that opens `{ ... }`, the block.
export type MenuProperty = {
  readonly keyword: number
  readonly values: readonly MenuValue[]
  readonly block: readonly MenuProperty[] | null
}

// `keyword "name" { properties }`; the name keeps at most eight characters, as the name table does.
export type MenuEntry = {
  readonly keyword: number
  readonly name: string
  readonly properties: readonly MenuProperty[]
}

// `keyword [ count ] { entries }`.
export type MenuSection = {
  readonly keyword: number
  readonly entries: readonly MenuEntry[]
}

// `0x27 total` then sections until the end of the file. `total` sizes the name table the entries are added to.
export type MenuFile = {
  readonly total: number
  readonly sections: readonly MenuSection[]
  readonly readByteCount: number
}

// What a property reads. `operands` are read in order. `counted` reads `count * integersPerItem` integers, where
// `count` is the first value of an earlier property of the same item (the original's field set by that property).
export type MenuPropertyGrammar =
  | { readonly kind: 'operands'; readonly operands: readonly MenuOperandKind[] }
  | { readonly kind: 'block'; readonly block: MenuBlockGrammar }
  | {
      readonly kind: 'counted'
      readonly countKeyword: number
      readonly integersPerItem: number
      // 0x0046a1f0 (menu description 0x3f) fails when the count is zero; 0x00470a... (styles) reads nothing.
      readonly isZeroCountFatal: boolean
    }

// A `{ ... }` of properties: an unknown keyword is the original's fatal syntax error, unless `fallback` takes it.
export type MenuBlockGrammar = {
  readonly properties: ReadonlyMap<number, MenuPropertyGrammar>
  readonly fallback: MenuBlockGrammar | null
}

// One kind of section: the keyword its entries open with, the grammar of an entry body, and the counts the original
// checks after reading an entry (a keyword that must occur at least once, or an exact number of times).
export type MenuSectionGrammar = {
  readonly entryKeyword: number
  readonly body: MenuBlockGrammar
  readonly minimumCounts: ReadonlyMap<number, number>
  readonly exactCounts: ReadonlyMap<number, number>
}

export type MenuFileGrammar = {
  readonly sections: ReadonlyMap<number, MenuSectionGrammar>
}

// The entry counts a section must reach or equal, as (keyword, count) pairs.
export type MenuSectionCounts = {
  readonly minimum?: readonly (readonly [number, number])[]
  readonly exact?: readonly (readonly [number, number])[]
}
