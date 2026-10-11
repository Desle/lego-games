import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { createNameTable } from '../../../../shared/name-table/name-table.ts'
import type {
  MenuBlockGrammar,
  MenuEntry,
  MenuFile,
  MenuFileGrammar,
  MenuOperandKind,
  MenuProperty,
  MenuPropertyGrammar,
  MenuSection,
  MenuSectionGrammar,
  MenuValue,
} from '../../types/menu-file.types.ts'

const FILE_KEYWORD = 0x27
const NAME_LENGTH = 8

const readOperand = (reader: TokenReader, kind: MenuOperandKind): MenuValue => {
  switch (kind) {
    case 'integer':
      return reader.readInteger()
    case 'float':
      return reader.readFloat()
    case 'string':
      return reader.readString()
  }
}

const getKeywordGrammar = (block: MenuBlockGrammar, keyword: number): MenuPropertyGrammar | null =>
  block.properties.get(keyword) ??
  (block.fallback === null ? null : getKeywordGrammar(block.fallback, keyword))

// `{ (keyword values | keyword { block })* }`: the loop of 0x00469a20 and its siblings. The opening brace must
// come first (error 5) and the end of the file inside a block is a syntax error.
const readBlock = (reader: TokenReader, grammar: MenuBlockGrammar): readonly MenuProperty[] => {
  reader.expectLeftCurly()
  const properties: MenuProperty[] = []
  const counts = new Map<number, number>()
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    const propertyGrammar = getKeywordGrammar(grammar, keyword)
    if (propertyGrammar === null) return reader.fail(TokenReaderFailure.INVALID_KEYWORD)
    const property = readProperty(reader, keyword, propertyGrammar, properties)
    counts.set(keyword, (counts.get(keyword) ?? 0) + 1)
    properties.push(property)
  }
  return Object.freeze(properties)
}

const readProperty = (
  reader: TokenReader,
  keyword: number,
  grammar: MenuPropertyGrammar,
  earlier: readonly MenuProperty[]
): MenuProperty => {
  switch (grammar.kind) {
    case 'operands':
      return Object.freeze({
        keyword,
        values: Object.freeze(grammar.operands.map((kind) => readOperand(reader, kind))),
        block: null,
      })
    case 'block':
      return Object.freeze({
        keyword,
        values: Object.freeze([]),
        block: readBlock(reader, grammar.block),
      })
    case 'counted': {
      const countProperty = earlier.findLast(
        (property) => property.keyword === grammar.countKeyword
      )
      const count = Number(countProperty?.values[0] ?? 0)
      if (count <= 0 && grammar.isZeroCountFatal)
        return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      const values: number[] = []
      for (let index = 0; index < Math.max(0, count) * grammar.integersPerItem; index++) {
        values.push(reader.readInteger())
      }
      return Object.freeze({ keyword, values: Object.freeze(values), block: null })
    }
  }
}

const getOccurrenceCount = (properties: readonly MenuProperty[], keyword: number): number =>
  properties.filter((property) => property.keyword === keyword).length

// 0x00469950 and friends: `keyword "name" { body }` with the checks that follow some of the readers.
const readEntry = (
  reader: TokenReader,
  grammar: MenuSectionGrammar,
  names: ReturnType<typeof createNameTable>,
  nameIndex: number
): MenuEntry => {
  reader.expectToken(grammar.entryKeyword)
  const name = reader.readStringWithMaximumLength(NAME_LENGTH)
  names.add(name, nameIndex)
  const properties = readBlock(reader, grammar.body)
  for (const [keyword, minimum] of grammar.minimumCounts) {
    if (getOccurrenceCount(properties, keyword) < minimum) {
      return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  for (const [keyword, exact] of grammar.exactCounts) {
    if (getOccurrenceCount(properties, keyword) !== exact) {
      return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({ keyword: grammar.entryKeyword, name, properties })
}

// LEGORacers.exe 0x0046b130 and 0x0046b250: `0x27 total`, then sections `keyword [ count ] { entries }` until the end
// of the file. Every entry name goes into one name table (a repeated name is fatal); `total` is its size.
export const parseMenuFile = (bytes: Uint8Array, grammar: MenuFileGrammar): MenuFile => {
  const reader = createTokenReader(bytes)
  if (reader.getNextToken() !== FILE_KEYWORD) reader.fail(TokenReaderFailure.EXPECTED_KEYWORD)
  const total = reader.readInteger()
  const names = createNameTable()
  const sections: MenuSection[] = []
  let nameIndex = 0
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.END_OF_FILE;
    keyword = reader.getNextToken()
  ) {
    const sectionGrammar = grammar.sections.get(keyword)
    if (sectionGrammar === undefined) return reader.fail(TokenReaderFailure.EXPECTED_KEYWORD)
    const count = reader.readArrayCount()
    const entries: MenuEntry[] = []
    for (let index = 0; index < count; index++) {
      entries.push(readEntry(reader, sectionGrammar, names, nameIndex))
      nameIndex += 1
    }
    reader.expectRightCurly()
    sections.push(Object.freeze({ keyword, entries: Object.freeze(entries) }))
  }
  return Object.freeze({
    total,
    sections: Object.freeze(sections),
    readByteCount: reader.getPosition(),
  })
}
