// Keywords of Timers_Load (LEGORacers.exe 0x00464aa0); timer offsets (0x24 bytes, filled by 0x00464750) in comments.
export const TimerKeyword = Object.freeze({
  TIMER: 0x27,
  FIRST_VALUE: 0x28, // +0x10
  SECOND_VALUE: 0x29, // +0x14
  IDENTIFIER: 0x2a, // +0x20
  // After 0x28 or 0x29: marks the value (flag 2 or 4) and an integer follows.
  MARKED: 0x2b,
  THIRD_VALUE: 0x2d, // +0x18; when 0, 0x00464750 starts the timer with the second value (0x00464a40)
})

export const DEFAULT_IDENTIFIER = -1
// 0x00464750 draws from the random table for a marked second value: modulo below 0x400, a multiple from it.
export const RANDOM_MODULO_LIMIT = 0x400
export const RANDOM_MULTIPLE_DIVISOR = 0x3ff
