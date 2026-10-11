import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { BestTime } from '../save-data.types.ts'

// FUN_0042e490 passes 0 for a best lap and 1 for a whole race's time to FUN_0042f310.
export const BestTimeKind = createEnum({
  LAP: 'lap',
  RACE: 'race',
})

export const NO_BEST_TIME: BestTime = Object.freeze({ milliseconds: 0, holderName: '' })

// FUN_0042e680: only races 0..11 of LEGORACE.RCB have a champion ghost (twelve GHOST.GHB files in LEGO.JAM).
export const CHAMPION_GHOST_COUNT = 12
export const ALL_GHOSTS_BEATEN_FLAGS = 0xfff
// FUN_0042f200(0x80) when the twelfth ghost falls.
export const GHOSTS_BEATEN_TROPHY_FLAG = 0x80
// The menu screen FUN_0042e680 shows after the twelfth ghost (settings +0x1c = 0x1c).
export const ALL_GHOSTS_BEATEN_SCREEN = 0x1c

// FUN_00443760 counts unlocked circuits in a row after circuit 0, six at most.
export const MAXIMUM_UNLOCK_CIRCUIT_INDEX = 6

// FUN_00483c60: the part table's requirement byte.
export const PART_REQUIRING_ALL_GHOSTS = 0x80
export const PART_TROPHY_BASE_REQUIREMENT = 3
