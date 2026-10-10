import { createEnum } from '../../../../shared/types/enum.types.ts'

// Keywords of the TRB readers: Triggers_Load (LEGORacers.exe 0x00465210) opens the list, 0x00465350 reads the
// shared keywords, and the main-trigger reader 0x00463dc0 adds 0x2c..0x2e.
export const TriggerKeyword = Object.freeze({
  TRIGGER: 0x27,
  POSITION: 0x29, // block +0x08..+0x10
  RADIUS: 0x2a, // block +0x14, passed to 0x00410f10 (centre x minus and plus it)
  FIRST_INTEGER: 0x2b, // block +0x04
  FLAG_1000: 0x2c, // main only: trigger +0x38 bit 0x1000
  OBJECT_NAME: 0x2d, // main only: looked up in the collision world, bit 0x2000
  SECOND_INTEGER: 0x2e, // main only: trigger +0x54, bit 0x4000
  FLAG_4: 0x2f, // block +0x18: trigger +0x38 bit 4
})

// MAINTRIG is read by 0x00463dc0 (race +0x2080), ENVIRON by 0x00464ff0 (race +0x2128).
export const TriggerFileKind = createEnum({
  MAIN: 'main',
  ENVIRONMENT: 'environment',
})

export const OBJECT_NAME_MAXIMUM_LENGTH = 8
