import { writeSaveBlocks } from '../save-blocks/save-blocks.ts'
import {
  BEST_TIME_ENTRY_BYTE_COUNT,
  BEST_TIME_NAME_CHARACTER_COUNT,
  BEST_TIME_TABLE_OFFSET,
  CIRCUIT_UNLOCK_FLAGS_OFFSET,
  GHOST_BEATEN_FLAGS_OFFSET,
  GRAPHICS_DEVICE_OFFSET,
  HEADER_DATA_BYTE_COUNT,
  HEADER_DATA_OFFSET_OFFSET,
  HEADER_RACER_COUNT_OFFSET,
  INPUT_CONFIGURATION_BYTE_COUNT,
  INPUT_CONFIGURATION_OFFSET,
  OPTION_BYTES_OFFSET,
  PLAYER_CONTROL_BYTE_COUNT,
  PLAYER_CONTROL_OFFSET,
  RACER_CHASSIS_BYTE_COUNT,
  RACER_CHASSIS_OFFSET,
  RACER_CIRCUIT_RANKS_OFFSET,
  RACER_COLOR_OFFSET,
  RACER_COUNT_OPTION_OFFSET,
  RACER_DATA_OFFSET,
  RACER_DESIGN_OFFSET,
  RACER_NAME_CHARACTER_COUNT,
  RACER_NAME_OFFSET,
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

// FUN_0042b560: the characters, then zeros up to the length.
const setUtf16Text = (
  view: DataView,
  offset: number,
  characterCount: number,
  text: string
): void => {
  for (let index = 0; index < characterCount; index += 1) {
    view.setUint16(offset + index * 2, text.charCodeAt(index) || 0, true)
  }
}

const setBestTime = (view: DataView, offset: number, bestTime: BestTime): void => {
  view.setUint32(offset, bestTime.milliseconds, true)
  setUtf16Text(view, offset + 4, BEST_TIME_NAME_CHARACTER_COUNT, bestTime.holderName)
}

const setInputConfiguration = (
  view: DataView,
  offset: number,
  configuration: InputConfiguration
): void => {
  view.setUint8(offset, configuration.kind)
  view.setUint8(offset + 1, configuration.secondKind)
  view.setUint8(offset + 2, configuration.deviceIndex)
  configuration.codes.forEach((code, index) => view.setUint32(offset + 3 + index * 4, code, true))
}

const setBytes = (data: Uint8Array, offset: number, bytes: readonly number[]): void =>
  data.set(bytes, offset)

const getHeaderData = (profile: SaveProfile, racerCount: number): Uint8Array => {
  const data = new Uint8Array(HEADER_DATA_BYTE_COUNT)
  const view = new DataView(data.buffer)
  data[0] = SIGNATURE_FIRST_BYTE
  data[1] = SIGNATURE_SECOND_BYTE
  data[HEADER_RACER_COUNT_OFFSET] = racerCount
  view.setUint16(HEADER_DATA_OFFSET_OFFSET, RACER_DATA_OFFSET, true)
  data[TROPHY_FLAGS_OFFSET] = profile.trophyFlags
  data[CIRCUIT_UNLOCK_FLAGS_OFFSET] = profile.circuitUnlockFlags
  view.setUint16(GHOST_BEATEN_FLAGS_OFFSET, profile.ghostBeatenFlags, true)
  profile.bestLapTimes.forEach((bestTime, track) =>
    setBestTime(view, BEST_TIME_TABLE_OFFSET + track * BEST_TIME_ENTRY_BYTE_COUNT, bestTime)
  )
  profile.bestRaceTimes.forEach((bestTime, track) =>
    setBestTime(view, BEST_TIME_TABLE_OFFSET + track * BEST_TIME_ENTRY_BYTE_COUNT + 0x20, bestTime)
  )
  data[RACER_COUNT_OPTION_OFFSET] = profile.racerCountOption
  setBytes(data, GRAPHICS_DEVICE_OFFSET, profile.graphicsDeviceIdentifier)
  setBytes(data, OPTION_BYTES_OFFSET, profile.optionBytes)
  profile.playerControlBytes.forEach((bytes, player) =>
    setBytes(data, PLAYER_CONTROL_OFFSET + player * PLAYER_CONTROL_BYTE_COUNT, bytes)
  )
  profile.inputConfigurations.forEach((configuration, index) =>
    setInputConfiguration(
      view,
      INPUT_CONFIGURATION_OFFSET + index * INPUT_CONFIGURATION_BYTE_COUNT,
      configuration
    )
  )
  setBytes(data, RESERVED_OFFSET, profile.reservedBytes)
  return data
}

const getRacerData = (racer: SaveRacer): Uint8Array => {
  const data = new Uint8Array(RACER_RECORD_DATA_BYTE_COUNT)
  const view = new DataView(data.buffer)
  setUtf16Text(view, RACER_NAME_OFFSET, RACER_NAME_CHARACTER_COUNT, racer.name)
  setBytes(data, RACER_COLOR_OFFSET, racer.colorBytes)
  setBytes(
    data,
    RACER_CHASSIS_OFFSET,
    Array.from(
      { length: RACER_CHASSIS_BYTE_COUNT },
      (_, index) => racer.chassisName.charCodeAt(index) || 0
    )
  )
  setBytes(data, RACER_DESIGN_OFFSET, racer.designBytes)
  view.setUint16(RACER_CIRCUIT_RANKS_OFFSET, racer.circuitRanks, true)
  return data
}

// FUN_00442700: the header, then each racer's record, all in blocks.
export const serializeSaveFile = (saveFile: SaveFile): Uint8Array => {
  const parts = [
    writeSaveBlocks(getHeaderData(saveFile.profile, saveFile.racers.length)),
    ...saveFile.racers.map((racer) => writeSaveBlocks(getRacerData(racer))),
  ]
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0))
  parts.reduce((position, part) => {
    bytes.set(part, position)
    return position + part.byteLength
  }, 0)
  return bytes
}
