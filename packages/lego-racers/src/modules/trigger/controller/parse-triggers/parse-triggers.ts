import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  OBJECT_NAME_MAXIMUM_LENGTH,
  TriggerFileKind,
  TriggerKeyword,
} from '../../types/trigger-keyword/trigger-keyword.ts'
import type {
  Trigger,
  TriggerFileKind as TriggerFileKindValue,
  TriggerList,
} from '../../types/trigger.types.ts'

const EMPTY_TRIGGER: Trigger = Object.freeze({
  position: Object.freeze([0, 0, 0] as const),
  radius: 0,
  firstInteger: 0,
  isFlag4Set: false,
  isFlag1000Set: false,
  objectName: null,
  secondInteger: null,
})

// 0x00465350: the keywords both trigger files share; any other is a syntax error.
const applySharedKeyword = (reader: TokenReader, keyword: number, trigger: Trigger): Trigger => {
  switch (keyword) {
    case TriggerKeyword.POSITION: {
      const x = reader.readFloat()
      const y = reader.readFloat()
      const z = reader.readFloat()
      return { ...trigger, position: Object.freeze([x, y, z] as const) }
    }
    case TriggerKeyword.RADIUS:
      return { ...trigger, radius: reader.readFloat() }
    case TriggerKeyword.FIRST_INTEGER:
      return { ...trigger, firstInteger: reader.readInteger() }
    case TriggerKeyword.FLAG_4:
      return { ...trigger, isFlag4Set: true }
    default:
      return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
}

// 0x00463dc0 handles 0x2c..0x2e itself before handing the rest to 0x00465350.
const applyMainKeyword = (reader: TokenReader, keyword: number, trigger: Trigger): Trigger => {
  switch (keyword) {
    case TriggerKeyword.FLAG_1000:
      return { ...trigger, isFlag1000Set: true }
    case TriggerKeyword.OBJECT_NAME:
      return {
        ...trigger,
        objectName: reader.readStringWithMaximumLength(OBJECT_NAME_MAXIMUM_LENGTH),
      }
    case TriggerKeyword.SECOND_INTEGER:
      return { ...trigger, secondInteger: reader.readInteger() }
    default:
      return applySharedKeyword(reader, keyword, trigger)
  }
}

const readTrigger = (
  reader: TokenReader,
  kind: TriggerFileKindValue,
  isMirrored: boolean
): Trigger => {
  reader.expectToken(TriggerKeyword.TRIGGER)
  reader.expectLeftCurly()
  const applyKeyword = kind === TriggerFileKind.MAIN ? applyMainKeyword : applySharedKeyword
  let trigger = EMPTY_TRIGGER
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    trigger = applyKeyword(reader, keyword, trigger)
  }
  if (!isMirrored) return Object.freeze(trigger)
  const [x, y, z] = trigger.position
  return Object.freeze({ ...trigger, position: Object.freeze([x, -y, z] as const) })
}

// 0x00465210 reads `0x27 [ count ] {`; the readers then read count blocks and never the closing curly.
export const parseTriggers = (
  bytes: Uint8Array,
  kind: TriggerFileKindValue,
  isMirrored: boolean
): TriggerList => {
  const reader = createTokenReader(bytes)
  reader.expectToken(TriggerKeyword.TRIGGER)
  const count = reader.readArrayCount() >>> 0
  const triggers = Array.from({ length: count }, () => readTrigger(reader, kind, isMirrored))
  return Object.freeze({ triggers: Object.freeze(triggers), readByteCount: reader.getPosition() })
}
