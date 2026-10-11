// A save file is a run of 0x80-byte blocks: 0x7f bytes of data and, last, their sum modulo 256 (FUN_00442840 writes,
// FUN_00442910 reads and compares; the sum is FUN_004429d0).
export const BLOCK_BYTE_COUNT = 0x80
export const BLOCK_DATA_BYTE_COUNT = 0x7f

// SaveFile_Parse 0x00442770 reads 0x477 bytes of header, then one 0x22d-byte record per racer.
export const HEADER_DATA_BYTE_COUNT = 0x477
export const RACER_RECORD_DATA_BYTE_COUNT = 0x22d
export const HEADER_BLOCK_COUNT = Math.ceil(HEADER_DATA_BYTE_COUNT / BLOCK_DATA_BYTE_COUNT)
export const RACER_RECORD_BLOCK_COUNT = Math.ceil(
  RACER_RECORD_DATA_BYTE_COUNT / BLOCK_DATA_BYTE_COUNT
)
// FUN_00442700 stores 0x0480 at header bytes 3 and 4 (little endian): the file position of the first racer.
export const RACER_DATA_OFFSET = HEADER_BLOCK_COUNT * BLOCK_BYTE_COUNT

export const SIGNATURE_FIRST_BYTE = 0x4c
export const SIGNATURE_SECOND_BYTE = 0x52

// The save file's open call passes 0x3e00 as a size (FUN_00443910, FUN_00443940): 124 blocks, which leaves room for
// 23 racers. Whether that is a limit or only a buffer size is not proven; DEFAULT.LRS and QBUILD.LRS hold 24.
export const SAVE_FILE_OPEN_SIZE = 0x3e00

// Header data offsets (FUN_00442c20 writes them from the in-memory profile, FUN_00442a00 reads them back).
export const HEADER_RACER_COUNT_OFFSET = 0x02
export const HEADER_DATA_OFFSET_OFFSET = 0x03
export const TROPHY_FLAGS_OFFSET = 0x05
export const CIRCUIT_UNLOCK_FLAGS_OFFSET = 0x06
export const GHOST_BEATEN_FLAGS_OFFSET = 0x07
export const BEST_TIME_TABLE_OFFSET = 0x09
export const BEST_TIME_ENTRY_BYTE_COUNT = 0x40
export const BEST_TIME_TRACK_COUNT = 13
export const BEST_TIME_NAME_CHARACTER_COUNT = 14
export const BEST_TIME_NAME_BYTE_COUNT = 0x1c
export const RACER_COUNT_OPTION_OFFSET = 0x349
export const GRAPHICS_DEVICE_OFFSET = 0x34a
export const GRAPHICS_DEVICE_BYTE_COUNT = 16
export const OPTION_BYTES_OFFSET = 0x35a
export const OPTION_BYTE_COUNT = 7
export const PLAYER_CONTROL_OFFSET = 0x361
export const PLAYER_CONTROL_BYTE_COUNT = 4
export const PLAYER_COUNT = 2
export const INPUT_CONFIGURATION_OFFSET = 0x369
export const INPUT_CONFIGURATION_BYTE_COUNT = 0x27
export const INPUT_CONFIGURATION_COUNT = 5
export const INPUT_CODE_COUNT = 9
export const RESERVED_OFFSET = INPUT_CONFIGURATION_OFFSET + INPUT_CONFIGURATION_BYTE_COUNT * 5

// Racer record data offsets (the in-memory record has a 0x14-byte prefix, so these are the fields' offsets minus 0x14).
export const RACER_NAME_OFFSET = 0x00
export const RACER_NAME_CHARACTER_COUNT = 14
export const RACER_COLOR_OFFSET = 0x1c
export const RACER_COLOR_BYTE_COUNT = 5
export const RACER_CHASSIS_OFFSET = 0x21
export const RACER_CHASSIS_BYTE_COUNT = 8
export const RACER_DESIGN_OFFSET = 0x29
export const RACER_CIRCUIT_RANKS_OFFSET = 0x22b
export const RACER_DESIGN_BYTE_COUNT = RACER_CIRCUIT_RANKS_OFFSET - RACER_DESIGN_OFFSET

// Bit 7 of the fifth colour byte belongs to the record, not to the colours (FUN_0042b330 masks it, FUN_0042b4b0 keeps it).
export const RACER_RECORD_FLAG_BIT = 0x80
