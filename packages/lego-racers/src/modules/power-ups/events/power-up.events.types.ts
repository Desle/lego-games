import type { Vector3 } from '../../simulation-math/index.ts'

// What the power-ups ask of a racer, the explosions and the projectile code; each names the original call.
export type PowerUpEvent =
  // 0x00439770: racer +0xd04 |= 0x1, +0xd6c = level.
  | {
      readonly type: 'power_ups.racer_shield_raised'
      readonly racer: number
      readonly level: number
    }
  // 0x00439790: racer +0xd04 &= ~0x1.
  | { readonly type: 'power_ups.racer_shield_lowered'; readonly racer: number }
  // 0x0043a270: a shield absorbed a hit; racer +0xd74 = 500 and the sound below plays.
  | {
      readonly type: 'power_ups.racer_shield_struck'
      readonly racer: number
      readonly sound: number
    }
  // Racer +0x39c |= 2 after a hit (car body flag; hypothesis: plays the hit reaction).
  | { readonly type: 'power_ups.racer_hit'; readonly racer: number }
  // Car body vtable slot +0x24 with this strength (oil slick 1.0, rocket 2.0); hypothesis: spin-out.
  | { readonly type: 'power_ups.racer_spun_out'; readonly racer: number; readonly strength: number }
  // 0x00439900 with the curse model: racer +0xd7c = duration, +0xd80 = 1000, +0xd04 |= 0x800.
  | {
      readonly type: 'power_ups.racer_cursed'
      readonly racer: number
      readonly durationMilliseconds: number
    }
  // 0x00439b00: the curse ends early because a shield was raised.
  | { readonly type: 'power_ups.racer_curse_lifted'; readonly racer: number }
  // 0x0045cd70: car body 0x00429cf0(-0.0025, boost), 0x004396c0(level), and 0x00439570 for level 2.
  | {
      readonly type: 'power_ups.racer_turbo_started'
      readonly racer: number
      readonly level: number
      readonly boostMilliseconds: number
    }
  // 0x00439730 then 0x004395a0 (which itself only acts when racer +0xd04 has 0x8).
  | { readonly type: 'power_ups.racer_turbo_ended'; readonly racer: number }
  // 0x0045d560: racer +0xd04 |= 0x200000.
  | { readonly type: 'power_ups.racer_warp_pending'; readonly racer: number }
  // 0x0045dc90 state 2: +0xd04 &= ~0x200000, then 0x004395d0 (+0xd04 |= 0x10, the car is taken off the track).
  | { readonly type: 'power_ups.racer_warp_started'; readonly racer: number }
  // 0x0045dc90 state 3: the racer is put down ahead (not ported) and 0x00439660 clears 0x10.
  | { readonly type: 'power_ups.racer_warp_ended'; readonly racer: number }
  // 0x0043a130: +0xd04 |= 0x100000.
  | { readonly type: 'power_ups.racer_magnetized'; readonly racer: number }
  // 0x0043a1a0.
  | { readonly type: 'power_ups.racer_released_by_magnet'; readonly racer: number }
  // 0x00455440: the wand stops the racer and throws it (car body slots +0x38, +0x1c; 0x00440100 for 100 ms).
  | { readonly type: 'power_ups.racer_struck_by_lightning'; readonly racer: number }
  // 0x004397b0 (car body slot +0x3c), 1000 ms later or when the wand is recycled.
  | { readonly type: 'power_ups.racer_released_by_lightning'; readonly racer: number }
  // 0x004545d0: the grapple latched on; 0x00453ef0 then pulls the two racers together (not ported).
  | { readonly type: 'power_ups.racer_grappled'; readonly racer: number; readonly owner: number }
  // 0x00454690: car body slot +0x44 on the latched racer and +0x4c on the owner.
  | { readonly type: 'power_ups.grapple_released'; readonly effect: number }
  // 0x00431310: a shield of level 2 or more sends the projectile back; the shielded racer becomes its owner.
  | {
      readonly type: 'power_ups.projectile_reflected'
      readonly effect: number
      readonly owner: number
    }
  // 0x0045b470 (cannon, rocket) and 0x0045b4f0 (barrel): an explosion object (class 0x004210b0, not ported).
  | {
      readonly type: 'power_ups.explosion'
      readonly effect: number
      readonly isSpiked: boolean
      // The explosion's second argument (0x00421520 +0x268): 1 for a barrel, and for a cannon or rocket
      // that hit ground whose normal has z above 0.7071 (hypothesis: a ground burst).
      readonly isGroundHit: boolean
      readonly offset: Vector3
    }
  // 0x0045b550: brick debris thrown from a hit racer (0x004517c0, not ported), one direction per piece.
  | {
      readonly type: 'power_ups.debris_thrown'
      readonly racer: number
      readonly directions: readonly Vector3[]
    }
  // 0x00439240: a driver voice.
  | { readonly type: 'power_ups.voice'; readonly racer: number; readonly sound: number }
  // 0x00439c90: using with nothing held sounds the horn (racer +0xd23) and notifies the event system.
  | { readonly type: 'power_ups.horn'; readonly racer: number }
