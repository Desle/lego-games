import { readSaveBlocks } from '../save-blocks/save-blocks.ts'
import { SaveFileError, SaveFileFailure } from '../../types/save-errors/save-errors.ts'
import {
  BEST_TIME_ENTRY_BYTE_COUNT,
  BEST_TIME_NAME_CHARACTER_COUNT,
  BEST_TIME_TABLE_OFFSET,
  BEST_TIME_TRACK_COUNT,
  CIRCUIT_UNLOCK_FLAGS_OFFSET,
  GHOST_BEATEN_FLAGS_OFFSET,
  GRAPHICS_DEVICE_BYTE_COUNT,
  GRAPHICS_DEVICE_OFFSET,
  HEADER_DATA_BYTE_COUNT,
  HEADER_DATA_OFFSET_OFFSET,
  HEADER_RACER_COUNT_OFFSET,
  INPUT_CODE_COUNT,
  INPUT_CONFIGURATION_BYTE_COUNT,
  INPUT_CONFIGURATION_COUNT,
  INPUT_CONFIGURATION_OFFSET,
  OPTION_BYTE_COUNT,
  OPTION_BYTES_OFFSET,
  PLAYER_CONTROL_BYTE_COUNT,
  PLAYER_CONTROL_OFFSET,
  PLAYER_COUNT,
  RACER_CHASSIS_BYTE_COUNT,
  RACER_CHASSIS_OFFSET,
  RACER_CIRCUIT_RANKS_OFFSET,
  RACER_COLOR_BYTE_COUNT,
  RACER_COLOR_OFFSET,
  RACER_DESIGN_BYTE_COUNT,
  RACER_DESIGN_OFFSET,
  RACER_NAME_CHARACTER_COUNT,
  RACER_NAME_OFFSET,
  RACER_COUNT_OPTION_OFFSET,
  RACER_RECORD_DATA_BYTE_COUNT,
  RESERVED_OFFSET,
  SIGNATURE_FIRST_BYTE,
  SIGNATURE_SECOND_BYTE,
  TROPHY_FLAGS_OFFSET,
} from '../../types/save-layout/save-layout.ts'
import type {
  BestTime,
  InputConfiguration,
  SaveFile,
  SaveProfile,
  SaveRacer,
} from '../../types/save-data.types.ts'

const getBytes = (data: Uint8Array, start: number, count: number): readonly number[] =>
  Object.freeze(Array.from(data.subarray(start, start + count)))

const getUnsignedDword = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true)

const getUnsignedWord = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, true)

// FUN_0042b400: UTF-16 characters until a zero or the limit.
export const getUtf16Text = (data: Uint8Array, offset: number, characterCount: number): string => {
  const characters: number[] = []
  for (let index = 0; index < characterCount; index += 1) {
    const character = getUnsignedWord(data, offset + index * 2)
    if (character === 0) break
    characters.push(character)
  }
  return String.fromCharCode(...characters)
}

// The chassis key is a C string of eight bytes, at most seven characters.
const getAsciiText = (data: Uint8Array, offset: number, byteCount: number): string => {
  const end = data.subarray(offset, offset + byteCount).indexOf(0)
  const length = end === -1 ? byteCount : end
  return String.fromCharCode(...data.subarray(offset, offset + length))
}

const getBestTime = (data: Uint8Array, offset: number): BestTime =>
  Object.freeze({
    milliseconds: getUnsignedDword(data, offset),
    holderName: getUtf16Text(data, offset + 4, BEST_TIME_NAME_CHARACTER_COUNT),
  })

const getInputConfiguration = (data: Uint8Array, offset: number): InputConfiguration =>
  Object.freeze({
    kind: data[offset] ?? 0,
    secondKind: data[offset + 1] ?? 0,
    deviceIndex: data[offset + 2] ?? 0,
    codes: Object.freeze(
      Array.from({ length: INPUT_CODE_COUNT }, (_, index) =>
        getUnsignedDword(data, offset + 3 + index * 4)
      )
    ),
  })

const getProfile = (data: Uint8Array): SaveProfile => {
  const trackIndices = Array.from({ length: BEST_TIME_TRACK_COUNT }, (_, index) => index)
  const getTrackOffset = (track: number): number =>
    BEST_TIME_TABLE_OFFSET + track * BEST_TIME_ENTRY_BYTE_COUNT
  return Object.freeze({
    trophyFlags: data[TROPHY_FLAGS_OFFSET] ?? 0,
    circuitUnlockFlags: data[CIRCUIT_UNLOCK_FLAGS_OFFSET] ?? 0,
    ghostBeatenFlags: getUnsignedWord(data, GHOST_BEATEN_FLAGS_OFFSET),
    bestLapTimes: Object.freeze(
      trackIndices.map((track) => getBestTime(data, getTrackOffset(track)))
    ),
    bestRaceTimes: Object.freeze(
      trackIndices.map((track) => getBestTime(data, getTrackOffset(track) + 0x20))
    ),
    racerCountOption: data[RACER_COUNT_OPTION_OFFSET] ?? 0,
    graphicsDeviceIdentifier: getBytes(data, GRAPHICS_DEVICE_OFFSET, GRAPHICS_DEVICE_BYTE_COUNT),
    optionBytes: getBytes(data, OPTION_BYTES_OFFSET, OPTION_BYTE_COUNT),
    playerControlBytes: Object.freeze(
      Array.from({ length: PLAYER_COUNT }, (_, player) =>
        getBytes(
          data,
          PLAYER_CONTROL_OFFSET + player * PLAYER_CONTROL_BYTE_COUNT,
          PLAYER_CONTROL_BYTE_COUNT
        )
      )
    ),
    inputConfigurations: Object.freeze(
      Array.from({ length: INPUT_CONFIGURATION_COUNT }, (_, index) =>
        getInputConfiguration(
          data,
          INPUT_CONFIGURATION_OFFSET + index * INPUT_CONFIGURATION_BYTE_COUNT
        )
      )
    ),
    reservedBytes: getBytes(data, RESERVED_OFFSET, HEADER_DATA_BYTE_COUNT - RESERVED_OFFSET),
  })
}

const getRacer = (data: Uint8Array): SaveRacer =>
  Object.freeze({
    name: getUtf16Text(data, RACER_NAME_OFFSET, RACER_NAME_CHARACTER_COUNT),
    colorBytes: getBytes(data, RACER_COLOR_OFFSET, RACER_COLOR_BYTE_COUNT),
    chassisName: getAsciiText(data, RACER_CHASSIS_OFFSET, RACER_CHASSIS_BYTE_COUNT),
    designBytes: getBytes(data, RACER_DESIGN_OFFSET, RACER_DESIGN_BYTE_COUNT),
    circuitRanks: getUnsignedWord(data, RACER_CIRCUIT_RANKS_OFFSET),
  })

// SaveFile_Parse 0x00442770: the header ("LR", the racer count, the position of the first racer, the profile), then
// the racers' records from that position on.
export const parseSaveFile = (bytes: Uint8Array): SaveFile => {
  const header = readSaveBlocks(bytes, 0, HEADER_DATA_BYTE_COUNT)
  if (header.data[0] !== SIGNATURE_FIRST_BYTE || header.data[1] !== SIGNATURE_SECOND_BYTE) {
    throw new SaveFileError(SaveFileFailure.BAD_SIGNATURE, 'the file does not start with "LR"')
  }
  const racerCount = header.data[HEADER_RACER_COUNT_OFFSET] ?? 0
  let position = getUnsignedWord(header.data, HEADER_DATA_OFFSET_OFFSET)
  const racers: SaveRacer[] = []
  for (let index = 0; index < racerCount; index += 1) {
    const record = readSaveBlocks(bytes, position, RACER_RECORD_DATA_BYTE_COUNT)
    racers.push(getRacer(record.data))
    position = record.nextPosition
  }
  return Object.freeze({ profile: getProfile(header.data), racers: Object.freeze(racers) })
}
