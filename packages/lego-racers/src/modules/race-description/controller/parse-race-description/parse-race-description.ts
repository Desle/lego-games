import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  DISPLAY_NAME_MAXIMUM_LENGTH,
  FILE_NAME_MAXIMUM_LENGTH,
  RaceDescriptionKeyword,
  TRACK_WORLD_OBJECT_MAXIMUM_LENGTH,
} from '../../types/race-description-keyword/race-description-keyword.ts'
import type { RaceDescription, Vector3 } from '../../types/race-description.types.ts'

const readName = (reader: TokenReader) =>
  reader.readStringWithMaximumLength(FILE_NAME_MAXIMUM_LENGTH)

const readVector = (reader: TokenReader): Vector3 => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  return Object.freeze([x, y, z] as const)
}

const negateY = (vector: Vector3): Vector3 => Object.freeze([vector[0], -vector[1], vector[2]])

// The keywords that store one name; 0x31 and 0x32 read one and drop it.
const SINGLE_NAME_FIELDS: ReadonlyMap<number, keyof RaceDescription | null> = new Map([
  [RaceDescriptionKeyword.BACKGROUND_WORLD, 'backgroundWorld'],
  [RaceDescriptionKeyword.EVENTS, 'events'],
  [RaceDescriptionKeyword.FONT_DATABASE, 'fontDatabase'],
  [RaceDescriptionKeyword.TRACK_WORLD, 'trackWorld'],
  [RaceDescriptionKeyword.IMAGE_DATABASE, 'imageDatabase'],
  [RaceDescriptionKeyword.MUSIC_LIST, 'musicList'],
  [RaceDescriptionKeyword.IGNORED_FIRST_NAME, null],
  [RaceDescriptionKeyword.IGNORED_SECOND_NAME, null],
  [RaceDescriptionKeyword.SHADOW_WORLD, 'shadowWorld'],
  [RaceDescriptionKeyword.ENVIRONMENT_TRIGGERS, 'environmentTriggers'],
  [RaceDescriptionKeyword.TIMERS, 'timers'],
  [RaceDescriptionKeyword.MAIN_TRIGGERS, 'mainTriggers'],
  [RaceDescriptionKeyword.BLENDED_WORLD, 'blendedWorld'],
  [RaceDescriptionKeyword.SOUND_BANK, 'soundBank'],
  [RaceDescriptionKeyword.VOICE_FOLDER, 'voiceFolder'],
  [RaceDescriptionKeyword.TRACK_SOUND_BANK, 'trackSoundBank'],
  [RaceDescriptionKeyword.GLOBAL_WORLD, 'globalWorld'],
  [RaceDescriptionKeyword.START_POSITIONS, 'startPositions'],
  [RaceDescriptionKeyword.SKY, 'sky'],
  [RaceDescriptionKeyword.TRACK_MATERIALS, 'trackMaterials'],
  [RaceDescriptionKeyword.HAZARDS, 'hazards'],
  [RaceDescriptionKeyword.LOCAL_WORLD, 'localWorld'],
  [RaceDescriptionKeyword.TAGGED_POSITIONS, 'taggedPositions'],
])

const createEmptyDescription = (displayName: string): RaceDescription => ({
  displayName,
  trackWorld: null,
  backgroundWorld: null,
  blendedWorld: null,
  globalWorld: null,
  localWorld: null,
  shadowWorld: null,
  collisionWorld: null,
  firstCollisionObject: null,
  secondCollisionObject: null,
  sky: null,
  startPositions: null,
  events: null,
  fontDatabase: null,
  imageDatabase: null,
  soundBank: null,
  voiceFolder: null,
  trackSoundBank: null,
  musicList: null,
  powerUpPlacements: null,
  powerUpMaterialAnimation: null,
  powerUpWorld: null,
  mainTriggers: null,
  environmentTriggers: null,
  timers: null,
  emitterDefinitions: null,
  trackEmitters: null,
  hazards: null,
  trackMaterials: null,
  checkpoints: null,
  checkpointObject: null,
  trackWorldObject: null,
  taggedPositions: null,
  cameraPoint: null,
  cameraVectors: null,
  displayBounds: null,
  readByteCount: 0,
})

const applyKeyword = (
  reader: TokenReader,
  keyword: number,
  description: RaceDescription
): RaceDescription => {
  const singleNameField = SINGLE_NAME_FIELDS.get(keyword)
  if (singleNameField !== undefined) {
    const name = readName(reader)
    return singleNameField === null ? description : { ...description, [singleNameField]: name }
  }
  switch (keyword) {
    case RaceDescriptionKeyword.CAMERA_VECTORS: {
      const first = readVector(reader)
      const second = readVector(reader)
      return { ...description, cameraVectors: Object.freeze([first, second] as const) }
    }
    case RaceDescriptionKeyword.CAMERA_POINT:
      return { ...description, cameraPoint: readVector(reader) }
    case RaceDescriptionKeyword.COLLISION_WORLD: {
      const collisionWorld = readName(reader)
      const firstCollisionObject = readName(reader)
      const secondCollisionObject = readName(reader)
      return { ...description, collisionWorld, firstCollisionObject, secondCollisionObject }
    }
    case RaceDescriptionKeyword.POWER_UPS: {
      const powerUpPlacements = readName(reader)
      const powerUpMaterialAnimation = readName(reader)
      const powerUpWorld = readName(reader)
      return { ...description, powerUpPlacements, powerUpMaterialAnimation, powerUpWorld }
    }
    case RaceDescriptionKeyword.EMITTERS: {
      const emitterDefinitions = readName(reader)
      const trackEmitters = readName(reader)
      return { ...description, emitterDefinitions, trackEmitters }
    }
    case RaceDescriptionKeyword.DISPLAY_BOUNDS: {
      const first = reader.readFloat()
      const second = reader.readFloat()
      const third = reader.readFloat()
      const fourth = reader.readFloat()
      return {
        ...description,
        displayBounds: Object.freeze([first, second, third, fourth] as const),
      }
    }
    case RaceDescriptionKeyword.CHECKPOINTS: {
      const checkpoints = readName(reader)
      const checkpointObject = readName(reader)
      return { ...description, checkpoints, checkpointObject }
    }
    case RaceDescriptionKeyword.TRACK_WORLD_OBJECT:
      return {
        ...description,
        trackWorldObject: reader.readStringWithMaximumLength(TRACK_WORLD_OBJECT_MAXIMUM_LENGTH),
      }
    default:
      return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
}

// After the closing curly, 0x00431e00 negates +0x1fc, +0x208 and +0x214 when its argument 3 is set.
const mirror = (description: RaceDescription): RaceDescription => ({
  ...description,
  cameraPoint: description.cameraPoint === null ? null : negateY(description.cameraPoint),
  cameraVectors:
    description.cameraVectors === null
      ? null
      : Object.freeze([
          negateY(description.cameraVectors[0]),
          negateY(description.cameraVectors[1]),
        ] as const),
})

// LEGORacers.exe 0x00431e00: `0x35 "name" { keyword values ... }`; nothing after the curly is read.
export const parseRaceDescription = (bytes: Uint8Array, isMirrored: boolean): RaceDescription => {
  const reader = createTokenReader(bytes)
  reader.expectToken(RaceDescriptionKeyword.DISPLAY_NAME)
  let description = createEmptyDescription(
    reader.readStringWithMaximumLength(DISPLAY_NAME_MAXIMUM_LENGTH)
  )
  reader.expectLeftCurly()
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    description = applyKeyword(reader, keyword, description)
  }
  if (isMirrored) description = mirror(description)
  return Object.freeze({ ...description, readByteCount: reader.getPosition() })
}
