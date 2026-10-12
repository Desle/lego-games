import { createTokenReader, readFloatTriple } from '../../../token-reader/index.ts'
import type { FloatTriple, TokenReader } from '../../../token-reader/index.ts'
import { CinemaKeyword } from '../../types/cinema-keyword/cinema-keyword.ts'
import type {
  Cinema,
  CinemaAction,
  CinemaDatabase,
  CinemaDummy,
  CinemaLight,
  CinemaObject,
  CinemaTiming,
} from '../../types/cinema.types.ts'

const NAME_MAXIMUM_LENGTH = 8
const RIGHT_CURLY_TOKEN = 6
const KEY_INTEGER_COUNT = 5
const DEFAULT_FRAMES_PER_SECOND = 0
const ORIGIN: FloatTriple = Object.freeze([0, 0, 0])
const FORWARD: FloatTriple = Object.freeze([1, 0, 0])
const UP: FloatTriple = Object.freeze([0, 0, 1])

type Orientation = { readonly forward: FloatTriple; readonly up: FloatTriple }

const readOrientation = (reader: TokenReader): Orientation => {
  const forward = readFloatTriple(reader)
  const up = readFloatTriple(reader)
  return Object.freeze({ forward, up })
}

const readName = (reader: TokenReader): string =>
  reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH)

// One entry: its keyword and name, then `{ keywords }` read by `applyKeyword`, which returns false for a keyword the
// entry does not know (the loaders skip those, 0x00404a10 and its siblings).
const readEntry = <Entry>(
  reader: TokenReader,
  keyword: number,
  create: (name: string) => Entry,
  applyKeyword: (token: number, entry: Entry) => Entry | null
): Entry => {
  reader.expectToken(keyword)
  let entry = create(readName(reader))
  reader.expectLeftCurly()
  for (
    let token = reader.getNextToken();
    token !== RIGHT_CURLY_TOKEN;
    token = reader.getNextToken()
  ) {
    entry = applyKeyword(token, entry) ?? entry
  }
  return entry
}

const readSection = <Entry>(
  reader: TokenReader,
  readOne: (reader: TokenReader) => Entry
): readonly Entry[] => {
  const entries: Entry[] = []
  for (let remaining = reader.readArrayCount(); remaining !== 0; remaining -= 1) {
    entries.push(readOne(reader))
  }
  reader.expectRightCurly()
  return Object.freeze(entries)
}

const getTiming = (name: string): CinemaTiming =>
  Object.freeze({ name, startFrame: 0, durationFrames: 0 })

const applyTimingKeyword = <Entry extends CinemaTiming>(
  reader: TokenReader,
  token: number,
  entry: Entry
): Entry | null => {
  if (token === CinemaKeyword.START) return { ...entry, startFrame: reader.readInteger() }
  if (token === CinemaKeyword.DURATION) return { ...entry, durationFrames: reader.readInteger() }
  return null
}

const readObject = (reader: TokenReader): CinemaObject =>
  Object.freeze(
    readEntry<CinemaObject>(
      reader,
      CinemaKeyword.OBJECT_SECTION,
      (name) => ({ ...getTiming(name), target: '', flag: 0 }),
      (token, entry) => {
        if (token === CinemaKeyword.TARGET) return { ...entry, target: readName(reader) }
        if (token === CinemaKeyword.FLAG) return { ...entry, flag: reader.readInteger() }
        return applyTimingKeyword(reader, token, entry)
      }
    )
  )

const readAction = (reader: TokenReader): CinemaAction =>
  Object.freeze(
    readEntry<CinemaAction>(
      reader,
      CinemaKeyword.ACTION_SECTION,
      (name) => ({
        ...getTiming(name),
        kind: 0,
        instanceName: '',
        position: ORIGIN,
        forward: FORWARD,
        up: UP,
        flag: 0,
        keys: [],
      }),
      (token, entry) => {
        switch (token) {
          case CinemaKeyword.FLAG:
            return { ...entry, flag: reader.readInteger() }
          case CinemaKeyword.MESH_INSTANCE_NAME:
            return { ...entry, kind: 1, instanceName: readName(reader) }
          case CinemaKeyword.SKELETON_INSTANCE_NAME:
            return { ...entry, kind: 2, instanceName: readName(reader) }
          case CinemaKeyword.THIRD_INSTANCE_NAME:
            return { ...entry, kind: 3, instanceName: readName(reader) }
          case CinemaKeyword.INTEGER_PAIR:
            reader.readInteger()
            reader.readInteger()
            return { ...entry, kind: 4 }
          case CinemaKeyword.POSITION:
            return { ...entry, position: readFloatTriple(reader) }
          case CinemaKeyword.ORIENTATION:
            return { ...entry, ...readOrientation(reader) }
          case CinemaKeyword.KEYS: {
            const keys = Array.from({ length: reader.readArrayCount() }, () =>
              Object.freeze(Array.from({ length: KEY_INTEGER_COUNT }, () => reader.readInteger()))
            )
            reader.expectRightCurly()
            return { ...entry, keys: Object.freeze(keys) }
          }
          default:
            return applyTimingKeyword(reader, token, entry)
        }
      }
    )
  )

const readDummy = (reader: TokenReader): CinemaDummy =>
  Object.freeze(
    readEntry<CinemaDummy>(
      reader,
      CinemaKeyword.DUMMY_SECTION,
      (name) => ({ ...getTiming(name), position: ORIGIN, forward: FORWARD, up: UP }),
      (token, entry) => {
        if (token === CinemaKeyword.POSITION) return { ...entry, position: readFloatTriple(reader) }
        if (token === CinemaKeyword.ORIENTATION) return { ...entry, ...readOrientation(reader) }
        return applyTimingKeyword(reader, token, entry)
      }
    )
  )

const readLight =
  (keyword: number) =>
  (reader: TokenReader): CinemaLight =>
    Object.freeze(
      readEntry<CinemaLight>(
        reader,
        keyword,
        (name) => ({ ...getTiming(name), red: 0, green: 0, blue: 0, direction: null }),
        (token, entry) => {
          if (token === CinemaKeyword.COLOUR) {
            const red = reader.readInteger()
            const green = reader.readInteger()
            return { ...entry, red, green, blue: reader.readInteger() }
          }
          if (token === CinemaKeyword.DIRECTION) {
            return { ...entry, direction: readFloatTriple(reader) }
          }
          if (token === CinemaKeyword.INTEGER_PAIR_OF_LIGHT) {
            reader.readInteger()
            reader.readInteger()
            return entry
          }
          return applyTimingKeyword(reader, token, entry)
        }
      )
    )

const getEnd = (timing: CinemaTiming): number => timing.startFrame + timing.durationFrames

// 0x00405950: a cinema is `{ keywords }` of sections; without its own length (0x2c) it is as long as its longest object.
const readCinema = (reader: TokenReader, name: string): Cinema => {
  let lengthFrames = 0
  let framesPerSecond = DEFAULT_FRAMES_PER_SECOND
  let objects: readonly CinemaObject[] = []
  let actions: readonly CinemaAction[] = []
  let dummies: readonly CinemaDummy[] = []
  let ambientLights: readonly CinemaLight[] = []
  let directionalLights: readonly CinemaLight[] = []
  reader.expectLeftCurly()
  for (
    let token = reader.getNextToken();
    token !== RIGHT_CURLY_TOKEN;
    token = reader.getNextToken()
  ) {
    switch (token) {
      case CinemaKeyword.OBJECT_SECTION:
        objects = readSection(reader, readObject)
        break
      case CinemaKeyword.LENGTH:
        lengthFrames = reader.readInteger()
        break
      case CinemaKeyword.ACTION_SECTION:
        actions = readSection(reader, readAction)
        break
      case CinemaKeyword.COLOUR_SECTION:
        ambientLights = readSection(reader, readLight(CinemaKeyword.COLOUR_SECTION))
        break
      case CinemaKeyword.DUMMY_SECTION:
        dummies = readSection(reader, readDummy)
        break
      case CinemaKeyword.LIGHT_SECTION:
        directionalLights = readSection(reader, readLight(CinemaKeyword.LIGHT_SECTION))
        break
      case CinemaKeyword.FRAMES_PER_SECOND:
        framesPerSecond = reader.readInteger()
        break
      default:
        break
    }
  }
  return Object.freeze({
    name,
    lengthFrames: lengthFrames === 0 ? Math.max(0, ...objects.map(getEnd)) : lengthFrames,
    framesPerSecond,
    objects,
    actions,
    dummies,
    ambientLights,
    directionalLights,
  })
}

const readCinemas = (reader: TokenReader): readonly Cinema[] => {
  const cinemas: Cinema[] = []
  for (let remaining = reader.readArrayCount(); remaining !== 0; remaining -= 1) {
    reader.expectToken(CinemaKeyword.CINEMAS)
    cinemas.push(readCinema(reader, readName(reader)))
  }
  reader.expectRightCurly()
  return Object.freeze(cinemas)
}

const readWorldNames = (reader: TokenReader): readonly string[] => {
  const names = Array.from({ length: reader.readArrayCount() }, () => readName(reader))
  reader.expectRightCurly()
  return Object.freeze(names)
}

// Cinema_Load 0x00406980: `0x28 [ count ] { name * count }` (the worlds) and `0x27 [ count ] { (0x27 name { sections }) *
// count }` (the cinemas), in any order; any other keyword is skipped.
export const parseCinemaDatabase = (bytes: Uint8Array): CinemaDatabase => {
  const reader = createTokenReader(bytes)
  let worldNames: readonly string[] = []
  let cinemas: readonly Cinema[] = []
  for (let token = reader.getNextToken(); token !== 0; token = reader.getNextToken()) {
    if (token === CinemaKeyword.CINEMAS) cinemas = readCinemas(reader)
    else if (token === CinemaKeyword.WORLD_NAMES) worldNames = readWorldNames(reader)
  }
  return Object.freeze({ worldNames, cinemas, readByteCount: reader.getPosition() })
}
