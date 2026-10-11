import {
  BinaryToken,
  createTokenReader,
  readFloatTriple,
  readKeywordsUntilRightCurly,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  EventBlockKeyword,
  EventSectionKeyword,
  NAME_MAXIMUM_LENGTH,
  NO_SIGNAL,
} from '../../types/event-keyword/event-keyword.ts'
import type {
  Event28,
  Event29,
  Event2A,
  Event3D,
  Event42,
  Event4B,
  Event4D,
  Event51,
  Event52,
  Event53,
  Event55,
  Event59,
  EventBody,
  EventSignalFields,
  IntegerQuadruple,
  EventBlockHeader,
  EventLink,
  EventPhaseSignals,
  EventSet,
  Vector3,
} from '../../types/event.types.ts'

const NO_PHASE_SIGNALS: EventPhaseSignals = Object.freeze({
  first: NO_SIGNAL,
  second: NO_SIGNAL,
  third: NO_SIGNAL,
})
const ORIGIN: Vector3 = Object.freeze([0, 0, 0] as const)
// 0x004b1b44 and 0x004b1b48: the defaults of keywords 0x31 and 0x32 in a 0x2a block (30.0 and 300.0).
const EVENT_2A_THIRD_FLOAT = 30
const EVENT_2A_FOURTH_FLOAT = 300

const readName = (reader: TokenReader): string =>
  reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH)

const negateY = (vector: Vector3): Vector3 =>
  Object.freeze([vector[0], -vector[1], vector[2]] as const)

// `[ count ] {` of every section (the readers check the three tokens one by one).
const readSectionCount = (reader: TokenReader): number => reader.readArrayCount() >>> 0

// `0x27 identifier`, then the optional 0x3c and the left curly.
const readBlockHeader = (reader: TokenReader): EventBlockHeader => {
  reader.expectToken(EventBlockKeyword.BLOCK)
  const identifier = reader.readInteger()
  const token = reader.getNextToken()
  if (token === EventBlockKeyword.BRACED) {
    reader.expectLeftCurly()
    return Object.freeze({ identifier, isBraced: true })
  }
  if (token !== BinaryToken.LEFT_CURLY) reader.fail(TokenReaderFailure.EXPECTED_LEFT_CURLY)
  return Object.freeze({ identifier, isBraced: false })
}

// 0x00461990 and 0x00461430 take no 0x3c.
const readPlainBlockHeader = (reader: TokenReader): EventBlockHeader => {
  reader.expectToken(EventBlockKeyword.BLOCK)
  const identifier = reader.readInteger()
  reader.expectLeftCurly()
  return Object.freeze({ identifier, isBraced: false })
}

// After 0x27 inside a block: 0x36, 0x34 or 0x37 and the id; any other token is a syntax error.
const readPhaseSignal = (reader: TokenReader, signals: EventPhaseSignals): EventPhaseSignals => {
  const token = reader.getNextToken()
  switch (token) {
    case EventBlockKeyword.PHASE_SIGNAL_FIRST:
      return { ...signals, first: reader.readInteger() }
    case EventBlockKeyword.PHASE_SIGNAL_SECOND:
      return { ...signals, second: reader.readInteger() }
    case EventBlockKeyword.PHASE_SIGNAL_THIRD:
      return { ...signals, third: reader.readInteger() }
    default:
      return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
}

const readKeywords = readKeywordsUntilRightCurly

// A block with phase signals: the header, then keywords where `0x27` reads one of the three signals.
const readSignalBlock = <Fields extends EventSignalFields>(
  reader: TokenReader,
  readHeader: (reader: TokenReader) => EventBlockHeader,
  defaults: Fields,
  applyKeyword: (keyword: number, value: Fields) => Fields | null
): EventBlockHeader & Fields => {
  const header = readHeader(reader)
  const fields = readKeywords(reader, defaults, (keyword, value) =>
    keyword === EventBlockKeyword.BLOCK
      ? { ...value, phaseSignals: readPhaseSignal(reader, value.phaseSignals) }
      : applyKeyword(keyword, value)
  )
  return Object.freeze({ ...header, ...fields })
}

const readPosition = (reader: TokenReader, isMirrored: boolean): Vector3 => {
  const position = readFloatTriple(reader)
  return isMirrored ? negateY(position) : position
}

const readSection = <Event>(reader: TokenReader, readEvent: () => Event): readonly Event[] => {
  const events = Array.from({ length: readSectionCount(reader) }, readEvent)
  reader.expectRightCurly()
  return Object.freeze(events)
}

const EVENT_2A_DEFAULTS: EventBody<Event2A> = Object.freeze({
  keyword2cInteger: 0,
  isKeyword2dSet: false,
  keyword2eInteger: 0,
  keyword2fFloat: 1,
  keyword30Float: 1,
  keyword31Float: EVENT_2A_THIRD_FLOAT,
  keyword32Float: EVENT_2A_FOURTH_FLOAT,
  objectName: null,
  isKeyword3aSet: false,
  position: ORIGIN,
  isKeyword3fSet: false,
  chance: 1,
  keyword54Integer: 0,
})

// 0x0045f220; a mirrored track negates the y of keyword 0x3b.
const readEvent2A = (reader: TokenReader, isMirrored: boolean): Event2A => {
  const header = readBlockHeader(reader)
  const fields = readKeywords<EventBody<Event2A>>(reader, EVENT_2A_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case 0x2c:
        return { ...value, keyword2cInteger: reader.readInteger() }
      case EventBlockKeyword.FLAG_2D:
        return { ...value, isKeyword2dSet: true }
      case 0x2e:
        return { ...value, keyword2eInteger: reader.readInteger() }
      case 0x2f:
        return { ...value, keyword2fFloat: reader.readFloat() }
      case 0x30:
        return { ...value, keyword30Float: reader.readFloat() }
      case 0x31:
        return { ...value, keyword31Float: reader.readFloat() }
      case 0x32:
        return { ...value, keyword32Float: reader.readFloat() }
      case EventBlockKeyword.OBJECT_NAME:
        return { ...value, objectName: readName(reader) }
      case EventBlockKeyword.FLAG_3A:
        return { ...value, isKeyword3aSet: true }
      case EventBlockKeyword.POSITION: {
        return { ...value, position: readPosition(reader, isMirrored) }
      }
      case EventBlockKeyword.FLAG_3F:
        return { ...value, isKeyword3fSet: true }
      case 0x40:
        return { ...value, chance: reader.readFloat() }
      case EventBlockKeyword.INTEGER_54:
        return { ...value, keyword54Integer: reader.readInteger() }
      default:
        return null
    }
  })
  return Object.freeze({ ...header, ...fields })
}

const EVENT_28_DEFAULTS: EventBody<Event28> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  isKeyword2dSet: false,
  objectReference: null,
  isKeyword41Set: false,
  keyword34Integer: 0,
  keyword35Integer: 0,
  keyword36Integer: NO_SIGNAL,
  keyword37Integer: NO_SIGNAL,
  isKeyword3aSet: false,
  isKeyword3fSet: false,
})

// 0x0045f660.
const readEvent28 = (reader: TokenReader): Event28 =>
  readSignalBlock(reader, readBlockHeader, EVENT_28_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case EventBlockKeyword.FLAG_2D:
        return { ...value, isKeyword2dSet: true }
      case EventBlockKeyword.OBJECT_NAME:
        return {
          ...value,
          objectReference: {
            name: readName(reader),
            isFromSecondWorld: value.isKeyword41Set,
          },
        }
      case 0x34:
        return { ...value, keyword34Integer: reader.readInteger() }
      case 0x35:
        return { ...value, keyword35Integer: reader.readInteger() }
      case 0x36:
        return { ...value, keyword36Integer: reader.readInteger() }
      case 0x37:
        return { ...value, keyword37Integer: reader.readInteger() }
      case EventBlockKeyword.FLAG_3A:
        return { ...value, isKeyword3aSet: true }
      case EventBlockKeyword.FLAG_3F:
        return { ...value, isKeyword3fSet: true }
      case EventBlockKeyword.OBJECT_NAME_FROM_SECOND_WORLD:
        return { ...value, isKeyword41Set: true }
      default:
        return null
    }
  })

const EVENT_29_DEFAULTS: EventBody<Event29> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  isKeyword2dSet: false,
  objectName: null,
  objectShort: 0,
  keyword34Integer: 0,
  keyword35Integer: 0,
  keyword38Integer: null,
  isKeyword3aSet: false,
  isKeyword3fSet: false,
})

// 0x0045fa30.
const readEvent29 = (reader: TokenReader): Event29 =>
  readSignalBlock(reader, readBlockHeader, EVENT_29_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case EventBlockKeyword.FLAG_2D:
        return { ...value, isKeyword2dSet: true }
      case EventBlockKeyword.OBJECT_NAME: {
        const objectName = readName(reader)
        return { ...value, objectName, objectShort: reader.readInteger() & 0xffff }
      }
      case 0x34:
        return { ...value, keyword34Integer: reader.readInteger() }
      case 0x35:
        return { ...value, keyword35Integer: reader.readInteger() }
      case 0x38:
        return { ...value, keyword38Integer: reader.readInteger() }
      case EventBlockKeyword.FLAG_3A:
        return { ...value, isKeyword3aSet: true }
      case EventBlockKeyword.FLAG_3F:
        return { ...value, isKeyword3fSet: true }
      default:
        return null
    }
  })

const EVENT_3D_DEFAULTS: EventBody<Event3D> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  isKeyword41Set: false,
  objectReference: null,
  isKeyword3aSet: false,
  position: ORIGIN,
  secondName: '',
  orientation: Object.freeze([1, 0, 0, 0, 0, 1] as const),
  isKeyword3fSet: false,
  keyword54Integer: 0,
})

// 0x0045feb0; a mirrored track negates the y of keywords 0x3b and the second and fifth floats of 0x3e.
const readEvent3D = (reader: TokenReader, isMirrored: boolean): Event3D =>
  readSignalBlock(reader, readBlockHeader, EVENT_3D_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case EventBlockKeyword.OBJECT_NAME:
        return {
          ...value,
          objectReference: {
            name: readName(reader),
            isFromSecondWorld: value.isKeyword41Set,
          },
        }
      case EventBlockKeyword.FLAG_3A:
        return { ...value, isKeyword3aSet: true }
      case EventBlockKeyword.POSITION: {
        return { ...value, position: readPosition(reader, isMirrored) }
      }
      case 0x3d:
        return { ...value, secondName: readName(reader) }
      case 0x3e: {
        const values = Array.from({ length: 6 }, () => reader.readFloat())
        const [first = 0, second = 0, third = 0, fourth = 0, fifth = 0, sixth = 0] = values
        return {
          ...value,
          orientation: Object.freeze(
            isMirrored
              ? ([first, -second, third, fourth, -fifth, sixth] as const)
              : ([first, second, third, fourth, fifth, sixth] as const)
          ),
        }
      }
      case EventBlockKeyword.FLAG_3F:
        return { ...value, isKeyword3fSet: true }
      case EventBlockKeyword.OBJECT_NAME_FROM_SECOND_WORLD:
        return { ...value, isKeyword41Set: true }
      case EventBlockKeyword.INTEGER_54:
        return { ...value, keyword54Integer: reader.readInteger() }
      default:
        return null
    }
  })

const EVENT_42_DEFAULTS: EventBody<Event42> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  name: '',
  keyword44Integer: 0,
  flags: 0,
})

// 0x00460430: keywords 0x45, 0x46, 0x47 and 0x48 set the bits 2, 1, 8 and 4 of a byte.
const readEvent42 = (reader: TokenReader): Event42 =>
  readSignalBlock(reader, readBlockHeader, EVENT_42_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case 0x43:
        return { ...value, name: readName(reader) }
      case 0x44:
        return { ...value, keyword44Integer: reader.readInteger() }
      case 0x45:
        return { ...value, flags: value.flags | 2 }
      case 0x46:
        return { ...value, flags: value.flags | 1 }
      case 0x47:
        return { ...value, flags: value.flags | 8 }
      case 0x48:
        return { ...value, flags: value.flags | 4 }
      default:
        return null
    }
  })

const EVENT_4B_DEFAULTS: EventBody<Event4B> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  keyword49Integer: 0,
  keyword4cInteger: NO_SIGNAL,
})

// 0x00460ad0.
const readEvent4B = (reader: TokenReader): Event4B =>
  readSignalBlock(reader, readBlockHeader, EVENT_4B_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case 0x49:
        return { ...value, keyword49Integer: reader.readInteger() }
      case 0x4c:
        return { ...value, keyword4cInteger: reader.readInteger() }
      default:
        return null
    }
  })

const ZERO_QUADRUPLE: IntegerQuadruple = Object.freeze([0, 0, 0, 0] as const)
const readIntegerQuadruple = (reader: TokenReader): IntegerQuadruple =>
  Object.freeze([
    reader.readInteger(),
    reader.readInteger(),
    reader.readInteger(),
    reader.readInteger(),
  ] as const)

const EVENT_4D_DEFAULTS: EventBody<Event4D> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  objectName: null,
  isKeyword3aSet: false,
  isKeyword50Set: false,
  // The original leaves both quadruples uninitialised when the keywords are absent; the port uses zeros.
  keyword4eIntegers: ZERO_QUADRUPLE,
  keyword4fIntegers: ZERO_QUADRUPLE,
})

// 0x00460720.
const readEvent4D = (reader: TokenReader): Event4D =>
  readSignalBlock(reader, readBlockHeader, EVENT_4D_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case EventBlockKeyword.OBJECT_NAME:
        return { ...value, objectName: readName(reader) }
      case EventBlockKeyword.FLAG_3A:
        return { ...value, isKeyword3aSet: true }
      case 0x4e:
        return { ...value, keyword4eIntegers: readIntegerQuadruple(reader) }
      case 0x4f:
        return { ...value, keyword4fIntegers: readIntegerQuadruple(reader) }
      case 0x50:
        return { ...value, isKeyword50Set: true }
      default:
        return null
    }
  })

const ZONE_WITHOUT_KEYWORD = 1
const EVENT_51_DEFAULTS: EventBody<Event51> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  zone: ZONE_WITHOUT_KEYWORD,
})

// 0x00461990: tokens 0x36 and 0x37 on their own pick the zone 0 and 2.
const readEvent51 = (reader: TokenReader): Event51 =>
  readSignalBlock(reader, readPlainBlockHeader, EVENT_51_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case EventBlockKeyword.PHASE_SIGNAL_FIRST:
        return { ...value, zone: 0 }
      case EventBlockKeyword.PHASE_SIGNAL_THIRD:
        return { ...value, zone: 2 }
      default:
        return null
    }
  })

const EVENT_52_DEFAULTS: EventBody<Event52> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  objectReference: null,
  secondObjectName: null,
  keyword54Integer: 0,
})

// 0x00460d10.
const readEvent52 = (reader: TokenReader): Event52 =>
  readSignalBlock(reader, readBlockHeader, EVENT_52_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case EventBlockKeyword.OBJECT_NAME:
        return { ...value, objectReference: { name: readName(reader), isFromSecondWorld: false } }
      case 0x4a:
        return { ...value, secondObjectName: readName(reader) }
      case EventBlockKeyword.INTEGER_54:
        return { ...value, keyword54Integer: reader.readInteger() }
      default:
        return null
    }
  })

const EVENT_53_DEFAULTS: EventBody<Event53> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  objectReference: null,
  isKeyword3aSet: false,
  isKeyword41Set: false,
  isKeyword46Set: false,
})

// 0x00461070.
const readEvent53 = (reader: TokenReader): Event53 =>
  readSignalBlock(reader, readBlockHeader, EVENT_53_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case EventBlockKeyword.OBJECT_NAME:
        return {
          ...value,
          objectReference: { name: readName(reader), isFromSecondWorld: value.isKeyword41Set },
        }
      case EventBlockKeyword.FLAG_3A:
        return { ...value, isKeyword3aSet: true }
      case EventBlockKeyword.OBJECT_NAME_FROM_SECOND_WORLD:
        return { ...value, isKeyword41Set: true }
      case 0x46:
        return { ...value, isKeyword46Set: true }
      default:
        return null
    }
  })

const EVENT_55_DEFAULTS: EventBody<Event55> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  position: ORIGIN,
})

// 0x00461430; a mirrored track negates the y of keyword 0x3b.
const readEvent55 = (reader: TokenReader, isMirrored: boolean): Event55 =>
  readSignalBlock(reader, readPlainBlockHeader, EVENT_55_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case EventBlockKeyword.POSITION: {
        return { ...value, position: readPosition(reader, isMirrored) }
      }
      default:
        return null
    }
  })

const EVENT_59_DEFAULTS: EventBody<Event59> = Object.freeze({
  phaseSignals: NO_PHASE_SIGNALS,
  position: ORIGIN,
  keyword4cInteger: NO_SIGNAL,
  keyword5aInteger: 0,
})

// 0x00461670; a mirrored track negates the y of keyword 0x3e.
const readEvent59 = (reader: TokenReader, isMirrored: boolean): Event59 =>
  readSignalBlock(reader, readBlockHeader, EVENT_59_DEFAULTS, (keyword, value) => {
    switch (keyword) {
      case 0x3e: {
        return { ...value, position: readPosition(reader, isMirrored) }
      }
      case 0x4c:
        return { ...value, keyword4cInteger: reader.readInteger() }
      case 0x5a:
        return { ...value, keyword5aInteger: reader.readInteger() }
      default:
        return null
    }
  })

// 0x00460320: `identifier { 0x39 integer }`, each pair on its own.
const readLink = (reader: TokenReader): EventLink => {
  reader.expectToken(EventBlockKeyword.BLOCK)
  const identifier = reader.readInteger()
  reader.expectLeftCurly()
  reader.expectToken(EventBlockKeyword.LINK)
  const linkedIdentifier = reader.readInteger()
  reader.expectRightCurly()
  return Object.freeze({ identifier, linkedIdentifier })
}

const EMPTY_EVENT_SET: Omit<EventSet, 'readByteCount'> = Object.freeze({
  events2A: Object.freeze([]),
  events28: Object.freeze([]),
  events29: Object.freeze([]),
  events3D: Object.freeze([]),
  events42: Object.freeze([]),
  events4B: Object.freeze([]),
  events4D: Object.freeze([]),
  events51: Object.freeze([]),
  events52: Object.freeze([]),
  events53: Object.freeze([]),
  events55: Object.freeze([]),
  events59: Object.freeze([]),
  links: Object.freeze([]),
})

// LEGORacers.exe 0x0045efa0: sections until the end of the file; a section seen twice replaces the first (the
// original leaks it), and any other token is a syntax error.
export const parseEvents = (bytes: Uint8Array, isMirrored: boolean): EventSet => {
  const reader = createTokenReader(bytes)
  let events: Omit<EventSet, 'readByteCount'> = EMPTY_EVENT_SET
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.END_OF_FILE;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case EventSectionKeyword.SECTION_28:
        events = { ...events, events28: readSection(reader, () => readEvent28(reader)) }
        break
      case EventSectionKeyword.SECTION_29:
        events = { ...events, events29: readSection(reader, () => readEvent29(reader)) }
        break
      case EventSectionKeyword.SECTION_2A:
        events = {
          ...events,
          events2A: readSection(reader, () => readEvent2A(reader, isMirrored)),
        }
        break
      case EventSectionKeyword.SECTION_39:
        events = { ...events, links: readSection(reader, () => readLink(reader)) }
        break
      case EventSectionKeyword.SECTION_3D:
        events = {
          ...events,
          events3D: readSection(reader, () => readEvent3D(reader, isMirrored)),
        }
        break
      case EventSectionKeyword.SECTION_42:
        events = { ...events, events42: readSection(reader, () => readEvent42(reader)) }
        break
      case EventSectionKeyword.SECTION_4B:
        events = { ...events, events4B: readSection(reader, () => readEvent4B(reader)) }
        break
      case EventSectionKeyword.SECTION_4D:
        events = { ...events, events4D: readSection(reader, () => readEvent4D(reader)) }
        break
      case EventSectionKeyword.SECTION_51:
        events = { ...events, events51: readSection(reader, () => readEvent51(reader)) }
        break
      case EventSectionKeyword.SECTION_52:
        events = { ...events, events52: readSection(reader, () => readEvent52(reader)) }
        break
      case EventSectionKeyword.SECTION_53:
        events = { ...events, events53: readSection(reader, () => readEvent53(reader)) }
        break
      case EventSectionKeyword.SECTION_55:
        events = {
          ...events,
          events55: readSection(reader, () => readEvent55(reader, isMirrored)),
        }
        break
      case EventSectionKeyword.SECTION_59:
        events = {
          ...events,
          events59: readSection(reader, () => readEvent59(reader, isMirrored)),
        }
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({ ...events, readByteCount: reader.getPosition() })
}
