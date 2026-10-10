import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { getSignedShort } from '../../../../shared/binary-values/binary-values.ts'
import { BspTreeKeyword, NO_NODE_INDEX } from '../../types/bsp-tree-keyword/bsp-tree-keyword.ts'
import { BspTreeNodeKind } from '../../types/bsp-tree-node-kind/bsp-tree-node-kind.ts'
import type {
  BspTree,
  BspTreeNode,
  BspTreeNodesSection,
  BspTreeSixFloats,
} from '../../types/bsp-tree.types.ts'

const NO_CHILDREN: BspTreeNode['childIndices'] = Object.freeze([NO_NODE_INDEX, NO_NODE_INDEX])
const ZERO_FLOATS: BspTreeNode['keyword28Floats'] = Object.freeze([0, 0, 0, 0])
const ZERO_VALUES: BspTreeNode['keyword29Values'] = Object.freeze([0, 0, 0, 0, 0])

// A negative index is stored as 0xffff; anything else as its low 16 bits.
const readNodeIndex = (reader: TokenReader): number => {
  const value = reader.readInteger()
  return value < 0 ? NO_NODE_INDEX : getSignedShort(value)
}

const readBranchNode = (reader: TokenReader): BspTreeNode => {
  const parentIndex = readNodeIndex(reader)
  const firstChildIndex = readNodeIndex(reader)
  const secondChildIndex = readNodeIndex(reader)
  if (secondChildIndex === NO_NODE_INDEX && firstChildIndex === NO_NODE_INDEX) {
    reader.fail(TokenReaderFailure.UNSUPPORTED)
  }
  const first = reader.readFloat()
  const second = reader.readFloat()
  const third = reader.readFloat()
  const fourth = reader.readFloat()
  return Object.freeze({
    kind: BspTreeNodeKind.BRANCH,
    parentIndex,
    childIndices: Object.freeze([firstChildIndex, secondChildIndex] as const),
    keyword28Floats: Object.freeze([first, second, third, fourth] as const),
    keyword29Values: ZERO_VALUES,
  })
}

const readLeafNode = (reader: TokenReader): BspTreeNode => {
  const parentIndex = readNodeIndex(reader)
  const first = reader.readInteger()
  const second = reader.readInteger()
  const third = getSignedShort(reader.readInteger())
  const fourth = getSignedShort(reader.readInteger())
  const fifth = getSignedShort(reader.readInteger())
  return Object.freeze({
    kind: BspTreeNodeKind.LEAF,
    parentIndex,
    childIndices: NO_CHILDREN,
    keyword28Floats: ZERO_FLOATS,
    keyword29Values: Object.freeze([first, second, third, fourth, fifth] as const),
  })
}

// 0x1001b010: `[ count ] { (0x28 … | 0x29 …)… }`.
const readNodes = (reader: TokenReader): BspTreeNodesSection => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const nodes: BspTreeNode[] = []
  let rootIndex = 0
  for (let index = 0; index < count >>> 0; index++) {
    const keyword = reader.getNextToken()
    if (keyword === BspTreeKeyword.BRANCH_NODE) nodes.push(readBranchNode(reader))
    else if (keyword === BspTreeKeyword.LEAF_NODE) nodes.push(readLeafNode(reader))
    else reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    if (nodes[index]?.parentIndex === NO_NODE_INDEX) rootIndex = index
  }
  reader.expectRightCurly()
  return Object.freeze({ nodes: Object.freeze(nodes), rootIndex })
}

// 0x1001b1a0: `[ count ] { (6 floats)… }`; the loop compares signed.
const readKeyword2aEntries = (reader: TokenReader): readonly BspTreeSixFloats[] => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const entries: BspTreeSixFloats[] = []
  for (let index = 0; index < count; index++) {
    const first = reader.readFloat()
    const second = reader.readFloat()
    const third = reader.readFloat()
    const fourth = reader.readFloat()
    const fifth = reader.readFloat()
    const sixth = reader.readFloat()
    entries.push(Object.freeze([first, second, third, fourth, fifth, sixth] as const))
  }
  reader.expectRightCurly()
  return Object.freeze(entries)
}

// Inline in 0x1001ae50: `[ count ] { int… }`, stored as int16; the loop compares signed.
const readKeyword2bValues = (reader: TokenReader): readonly number[] => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const values: number[] = []
  for (let index = 0; index < count; index++) values.push(getSignedShort(reader.readInteger()))
  reader.expectRightCurly()
  return Object.freeze(values)
}

// GolDP.dll 0x1001ae50: sections until the end of the file; a repeated section replaces the earlier one.
export const parseBspTree = (bytes: Uint8Array): BspTree => {
  const reader = createTokenReader(bytes)
  let nodes: readonly BspTreeNode[] = Object.freeze([])
  let rootIndex: number | null = null
  let keyword2aEntries: readonly BspTreeSixFloats[] = Object.freeze([])
  let keyword2bValues: readonly number[] = Object.freeze([])
  for (
    let token = reader.getNextToken();
    token !== BinaryToken.END_OF_FILE;
    token = reader.getNextToken()
  ) {
    if (token === BspTreeKeyword.NODES) {
      const section = readNodes(reader)
      nodes = section.nodes
      rootIndex = section.rootIndex
    } else if (token === BspTreeKeyword.KEYWORD_2A) {
      keyword2aEntries = readKeyword2aEntries(reader)
    } else if (token === BspTreeKeyword.KEYWORD_2B) {
      keyword2bValues = readKeyword2bValues(reader)
    } else {
      reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({
    nodes,
    rootIndex,
    keyword2aEntries,
    keyword2bValues,
    readByteCount: reader.getPosition(),
  })
}
