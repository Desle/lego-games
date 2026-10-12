import type { GhostStartRule } from './start-slot.types.ts'

// The multiplayer grid slot of racer 0 (0x0043ba6c: `MOV [EBP + 0x26c], 2`).
const MULTIPLAYER_FIRST_RACER_SLOT = 2
const GHOST_RACE_SLOT = 1

// RacerSet slot table +0x26c (0x0043ba2c..0x0043ba76): racer i takes start position slot i, except that with two
// or more local players and no ghost racer 0 takes slot 2. With a ghost every racer takes slot 1, or slot 2 while the
// champion ghost is loaded (ghost flag 0x08: `(flags & 8 != 0) + 1`).
// 0x00429210 (the car attach) adds no offset: the car starts exactly at its slot's position and axes.
export const getStartSlot = (
  racerIndex: number,
  isMultiplayer: boolean,
  ghost: GhostStartRule | null = null
): number => {
  if (ghost !== null) return ghost.isChampionLoaded ? GHOST_RACE_SLOT + 1 : GHOST_RACE_SLOT
  return isMultiplayer && racerIndex === 0 ? MULTIPLAYER_FIRST_RACER_SLOT : racerIndex
}
