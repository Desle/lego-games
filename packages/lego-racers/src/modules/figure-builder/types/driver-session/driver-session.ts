import { createEnum } from '../../../../shared/types/enum.types.ts'

// The four parts the driver editor chooses (0x0047d2f0: `hatsel`, `facesel`, `torsosel`, `legsel`), in the order of its
// choosers and of `BODYPART.PCB` (hats, heads, torsos, legs).
export const DriverPart = createEnum({
  HAT: 'hat',
  FACE: 'face',
  TORSO: 'torso',
  LEGS: 'legs',
})

export const DRIVER_PARTS = Object.freeze([
  DriverPart.HAT,
  DriverPart.FACE,
  DriverPart.TORSO,
  DriverPart.LEGS,
])

// The catalogue's requirement byte that no trophy meets: every ghost beaten (0x80, 0x00483c60).
export const ALL_GHOSTS_REQUIREMENT = 0x80
