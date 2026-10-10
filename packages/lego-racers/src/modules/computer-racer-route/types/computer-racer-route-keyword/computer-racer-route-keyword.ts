import { createEnum } from '../../../../shared/types/enum.types.ts'

// Keywords of AiRoute_Load (LEGORacers.exe 0x004a4e30, jump table 0x004a5078); route offsets in comments.
export const ComputerRacerRouteKeyword = Object.freeze({
  SAMPLES: 0x27, // +0x00 count, +0x04 samples (0x004a5100)
  FIRST_QUATERNION: 0x28, // +0x14..+0x20
  FIRST_VECTOR: 0x29, // +0x08..+0x10
  SECOND_VECTOR: 0x2a, // +0x24..+0x2c
  SECOND_QUATERNION: 0x2b, // +0x30..+0x3c
  FIRST_INTEGER: 0x2c, // +0x40
  SAMPLE_INDEX: 0x2d, // +0x44, must be below the sample count
})

// The fourth letter of `r{racer}_{letter}_{variant}`, tried in this order by 0x00433190.
export const ComputerRacerRouteLetter = createEnum({
  F: 'f',
  M: 'm',
  S: 's',
})

export const SAMPLE_BYTE_COUNT = 8
// 0x00433190 stops counting variants of one letter at ten.
export const MAXIMUM_VARIANT_COUNT = 10
// 0x004beeec, tried as r1_f_0, r1_m_0, r1_s_0 when no computer racer got a route.
export const FALLBACK_ROUTE_RACER = 1
