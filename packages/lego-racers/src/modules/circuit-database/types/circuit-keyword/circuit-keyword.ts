// Keywords of FUN_0041f030 (LEGORacers.exe 0x0041f030, called by Circuits_Load 0x0041f1d0).
export const CircuitKeyword = Object.freeze({
  CIRCUITS: 0x27,
  RACER_CODES: 0x28, // +0x14 count, +0x18 names; `[ count ] { name * count }`
  FIRST_NUMBER: 0x29, // +0x60, integer kept as a 16-bit value
  SECOND_NUMBER: 0x2a, // +0x58
  NEXT_NAME: 0x2b, // +0x0c, a string copied with strncpy over eight characters
})

// The record is 100 bytes and the names start at +0x18, so the original writes past +0x58 beyond this many names.
export const CIRCUIT_RACER_CODE_CAPACITY = 8
