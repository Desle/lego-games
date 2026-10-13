import type { PowerUpEvent } from '../../events/power-up.events.types.ts'

// The sounds the power-up code plays through the race's sound player; each is named after the function that plays it
// and carries the return address of its call, which the audio trace reports.

const createSound = (soundId: number, address: string): PowerUpEvent =>
  Object.freeze({ type: 'power_ups.sound_played', soundId, address })

// Rocket_Start 0x00456560: sound 0x33 (call returns to 0x00456668), once per rocket.
export const ROCKET_LAUNCH_SOUND = createSound(0x33, '0x00456668') // 0x00456668

// Rocket_Update 0x004568f0: sound 0x32 for a rocket that hit the ground (0x00456a6e).
export const ROCKET_GROUND_HIT_SOUND = createSound(0x32, '0x00456a6e') // 0x00456a6e

// Cannon_Update 0x00451b50: sound 5 for a ball that ended elsewhere (0x00451c55).
export const CANNON_END_SOUND = createSound(5, '0x00451c55') // 0x00451c55

// Barrel_Update 0x00452ff0: sound 5 for a barrel that burst (0x004530ad).
export const BARREL_END_SOUND = createSound(5, '0x004530ad') // 0x004530ad

// OilSlick_Advance 0x004573a0: sound 0x2e as the slick lands (0x00457431).
export const OIL_LANDING_SOUND = createSound(0x2e, '0x00457431') // 0x00457431

// Shield_Advance 0x0045c2a0, state 4: sound 0x3b (0x0045c2fc).
export const SHIELD_END_SOUND = createSound(0x3b, '0x0045c2fc') // 0x0045c2fc

// Warp_Advance 0x0045dc90: sounds 0x27 (0x0045dfa8) and 0x41 (0x0045dfca) as it starts, 0x29 (0x0045dec3) as it ends.
export const WARP_START_SOUND = createSound(0x27, '0x0045dfa8') // 0x0045dfa8
export const WARP_SOUND = createSound(0x41, '0x0045dfca') // 0x0045dfca
export const WARP_END_SOUND = createSound(0x29, '0x0045dec3') // 0x0045dec3

// 0x00454360 state 2: the grapple's launch sound 0x15 (0x004545c0).
export const GRAPPLE_LAUNCH_SOUND = createSound(0x15, '0x004545c0') // 0x004545c0

// Grapple_Retract 0x00454690: sound 0x14 for a latched racer (0x00454724); 0x16 (0x00454701) and 0x49 (0x00454724) when
// nobody is latched.
export const GRAPPLE_LATCHED_RELEASE_SOUND = createSound(0x14, '0x00454724') // 0x00454724
export const GRAPPLE_SNAP_SOUND = createSound(0x16, '0x00454701') // 0x00454701
export const GRAPPLE_RELEASE_SOUND = createSound(0x49, '0x00454724') // 0x00454724

// Wand_Advance 0x00455060, state 4: sound 0x42 (0x004550c3). 0x00454e50: the spark's sound 0x45 (0x00454fd0).
export const WAND_END_SOUND = createSound(0x42, '0x004550c3') // 0x004550c3
export const WAND_SPARK_SOUND = createSound(0x45, '0x00454fd0') // 0x00454fd0

// Magnet: 0x004560b0 places it with sound 0x21 (0x0045622a); 0x00455f50 begins its last second with 0x4a (0x00455fa9).
export const MAGNET_PLACE_SOUND = createSound(0x21, '0x0045622a') // 0x0045622a
export const MAGNET_LAST_SECOND_SOUND = createSound(0x4a, '0x00455fa9') // 0x00455fa9

// The looped sounds a power-up effect makes with RaceSounds_Get 0x00443bd0 and the address of that call's return.
// Wand_Start 0x00454cb0: sound 0x44 (0x00454d03).
export const WAND_HUM_SOUND_ID = 0x44 // 0x00454d03
export const WAND_HUM_ADDRESS = '0x00454d03' // 0x00454d03
// 0x004560b0: sound 0x22 (0x0045623d).
export const MAGNET_HUM_SOUND_ID = 0x22 // 0x0045623d
export const MAGNET_HUM_ADDRESS = '0x0045623d' // 0x0045623d
// Barrel_Advance 0x00453240, case 2: sound 0x11 (0x004533a1).
export const BARREL_HUM_SOUND_ID = 0x11 // 0x004533a1
export const BARREL_HUM_ADDRESS = '0x004533a1' // 0x004533a1
// 0x00452ae0, state 2: sound 9 (0x00452d13).
export const CURSE_HUM_SOUND_ID = 9 // 0x00452d13
export const CURSE_HUM_ADDRESS = '0x00452d13' // 0x00452d13
