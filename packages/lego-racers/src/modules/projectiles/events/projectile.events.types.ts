import type { Vector3 } from '../../simulation-math/index.ts'

// What the moving effects ask of the racers, the explosions and the sound code; each names the original call.
export type ProjectileEvent =
  // Car body vtable slot +0x20 (0x00429770): the magnet pulls the racer along a unit direction for this many
  // milliseconds' worth of force (hypothesis: steers the car body's pull target).
  | {
      readonly type: 'projectiles.racer_pulled'
      readonly racer: number
      readonly direction: Vector3
      readonly strength: number
    }
  // 0x00439570: racer +0xd04 |= 0x8 and car body slots +0x2c and +0x30 (only sent when the flag was clear).
  | { readonly type: 'projectiles.racer_tumbling_started'; readonly racer: number }
  // 0x00429cf0(car body, factor, milliseconds): the boost the magnet gives its owner when it lands.
  | {
      readonly type: 'projectiles.racer_boosted'
      readonly racer: number
      readonly factor: number
      readonly milliseconds: number
    }
  // Car body slot +0x40 (0x004298a0, the latched racer: vector stored at body +0x630, flag +0x6c0 |= 0x20) or slot
  // +0x48 (0x004298f0, the grapple's owner: +0x63c, flag 0x40), the vector scaled by body +0x15c on the body's side.
  | {
      readonly type: 'projectiles.racer_towed'
      readonly racer: number
      readonly vector: Vector3
      readonly isOwner: boolean
    }
  // Car body slots +0x44 and +0x4c (0x004298d0, 0x00429920): the tow ends (flags +0x6c0 &= ~0x20 and ~0x40).
  | { readonly type: 'projectiles.racer_tow_ended'; readonly racer: number }
  // 0x0045d780 state 3: the warp moves the racer's frame (racer +0x5c, slot 8) to this position.
  | { readonly type: 'projectiles.racer_moved'; readonly racer: number; readonly position: Vector3 }
  // 0x0045dc90 state 3 with 0x0045e080: the warp ends; the racer's frame goes to this position facing forward, its
  // velocity is cleared and car body slot +0x20 (0x00429770) is given the speed (hypothesis: sets it moving).
  | {
      readonly type: 'projectiles.racer_landed'
      readonly racer: number
      readonly position: Vector3
      readonly forward: Vector3
      readonly speed: number
    }
