import { createTokenReader } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import type {
  CinemaEmitterEvent,
  CinemaEvents,
  CinemaReaction,
  CinemaReactionList,
  CinemaVertexEffect,
} from '../../types/cinema-events.types.ts'

const NAME_MAXIMUM_LENGTH = 8
const RIGHT_CURLY_TOKEN = 6
const POOL_NAMES_KEYWORD = 0x27
const VERTEX_EFFECT_KEYWORD = 0x2b
const EMITTER_EVENT_KEYWORD = 0x3c
const FIRST_REACTION_LIST_KEYWORD = 0x50
const LAST_REACTION_LIST_KEYWORD = 0x57
const EMITTER_POOL_KEYWORD = 0x3d
const INTEGERS_KEYWORD = 0x2d
const MATERIAL_KEYWORD = 0x5e
const START_KEYWORD = 0x4e
const STOP_KEYWORD = 0x4f
const EFFECT_INTEGER_COUNT = 3

const readName = (reader: TokenReader): string =>
  reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH)

const readEntries = <Entry>(
  reader: TokenReader,
  keyword: number,
  readBody: (name: string) => Entry
): readonly Entry[] => {
  const entries: Entry[] = []
  for (let remaining = reader.readArrayCount(); remaining !== 0; remaining -= 1) {
    reader.expectToken(keyword)
    const name = readName(reader)
    reader.expectLeftCurly()
    entries.push(readBody(name))
  }
  reader.expectRightCurly()
  return Object.freeze(entries)
}

// FUN_004a3ad0 for the emitter keywords: only the pool and the emitter name matter to the preview.
const readEmitterEvent = (reader: TokenReader, name: string): CinemaEmitterEvent => {
  let poolIndex = 0
  let emitterName = ''
  for (
    let token = reader.getNextToken();
    token !== RIGHT_CURLY_TOKEN;
    token = reader.getNextToken()
  ) {
    if (token === EMITTER_POOL_KEYWORD) {
      poolIndex = reader.readInteger()
      emitterName = readName(reader)
    }
  }
  return Object.freeze({ name, poolIndex, emitterName })
}

const readVertexEffect = (reader: TokenReader, name: string): CinemaVertexEffect => {
  let integers: readonly number[] = []
  let materialName = ''
  for (
    let token = reader.getNextToken();
    token !== RIGHT_CURLY_TOKEN;
    token = reader.getNextToken()
  ) {
    if (token === INTEGERS_KEYWORD) {
      integers = Object.freeze(
        Array.from({ length: EFFECT_INTEGER_COUNT }, () => reader.readInteger())
      )
    } else if (token === MATERIAL_KEYWORD) {
      materialName = readName(reader)
    }
  }
  return Object.freeze({ name, integers, materialName })
}

// FUN_004a2730: `0x5x [ count ] { (0x5x "entry" { target 0x4e|0x4f "name" }) * count }`.
const readReactionList = (reader: TokenReader, listKeyword: number): CinemaReactionList => {
  const starts: CinemaReaction[] = []
  const stops: CinemaReaction[] = []
  for (let remaining = reader.readArrayCount(); remaining !== 0; remaining -= 1) {
    reader.expectToken(listKeyword)
    const entryName = readName(reader)
    reader.expectLeftCurly()
    const targetKeyword = reader.getNextToken()
    const action = reader.getNextToken()
    const reaction = Object.freeze({ entryName, targetKeyword, targetName: readName(reader) })
    if (action === START_KEYWORD) starts.push(reaction)
    else if (action === STOP_KEYWORD) stops.push(reaction)
    reader.expectRightCurly()
  }
  reader.expectRightCurly()
  return Object.freeze({
    listKeyword,
    starts: Object.freeze(starts),
    stops: Object.freeze(stops),
  })
}

// CinemaEvents_Load 0x004a0730: the sections of a `.CEB` in any order; the ones the previews use are read.
export const parseCinemaEvents = (bytes: Uint8Array): CinemaEvents => {
  const reader = createTokenReader(bytes)
  let poolNames: readonly string[] = []
  let emitterEvents: readonly CinemaEmitterEvent[] = []
  let vertexEffects: readonly CinemaVertexEffect[] = []
  const reactionLists: CinemaReactionList[] = []
  for (let token = reader.getNextToken(); token !== 0; token = reader.getNextToken()) {
    if (token === POOL_NAMES_KEYWORD) {
      poolNames = Object.freeze(
        Array.from({ length: reader.readArrayCount() }, () => readName(reader))
      )
      reader.expectRightCurly()
    } else if (token === EMITTER_EVENT_KEYWORD) {
      emitterEvents = readEntries(reader, EMITTER_EVENT_KEYWORD, (name) =>
        readEmitterEvent(reader, name)
      )
    } else if (token === VERTEX_EFFECT_KEYWORD) {
      vertexEffects = readEntries(reader, VERTEX_EFFECT_KEYWORD, (name) =>
        readVertexEffect(reader, name)
      )
    } else if (token >= FIRST_REACTION_LIST_KEYWORD && token <= LAST_REACTION_LIST_KEYWORD) {
      reactionLists.push(readReactionList(reader, token))
    }
  }
  return Object.freeze({
    poolNames,
    emitterEvents,
    vertexEffects,
    reactionLists: Object.freeze(reactionLists),
  })
}
