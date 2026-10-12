import type { BallisticFlight } from '../../projectiles/index.ts'
import type { Vector3 } from './hazard.types.ts'
import type { InstanceReference } from './hazard-runtime.types.ts'

// What a hazard class keeps besides its identifier and lifecycle state; offsets are in the class's object. The
// `keyword` tags tell the classes apart.

// 0x2a (0x0048cff0): watches the clip time of the Royal Knights hammer and tells the events when it strikes.
export type HammerWatcherData = {
  readonly keyword: 0x2a
  // +0x10
  readonly hammer: InstanceReference | null
  // +0x14: bit 0 means the hammer may strike (the clip time went through the armed windows).
  readonly flags: number
}

// 0x28 (0x0048b890): a pillar that falls; its collision object turns solid when the clip passes a frame.
export type PillarData = {
  readonly keyword: 0x28
  // +0x10: "piltop"
  readonly pillar: InstanceReference | null
  // +0x18: the name of the collision object in the race's list, "pilcol"
  readonly collisionObjectName: string
  // +0x1c: 1 once the collision object is solid.
  readonly isSolid: boolean
}

// 0x29 (0x0048c020): the exploding sphinx.
export type SphinxData = {
  readonly keyword: 0x29
  // +0x1c: "blowup" in the second world.
  readonly explosion: InstanceReference | null
  // The index of the second world's material animation named "blowup", and the entry its non-looping copy plays in
  // (+0x18), or null while none plays.
  readonly materialAnimationIndex: number | null
  // +0x20: the collision object "sphinx"
  readonly collisionObjectName: string
}

// 0x36 (0x0048b080): scrolls a texture.
export type ScrollerData = {
  readonly keyword: 0x36
  // +0x10
  readonly instance: InstanceReference | null
  // +0x14, +0x18
  readonly firstFloat: number
  readonly secondFloat: number
  // +0x1c: milliseconds into the 10,000 ms cycle.
  readonly cycleMilliseconds: number
}

// 0x49 (0x0048ae80): a warp pad; a racer that touches it is warped to a fixed destination.
export type WarpPadData = {
  readonly keyword: 0x49
  // +0x14: the track is mirrored.
  readonly isMirrored: boolean
}

// 0x3f (0x0048b2f0): drops a power-up hazard at one of three places.
export type HazardDropperData = {
  readonly keyword: 0x3f
  readonly isMirrored: boolean
}

// 0x40 (0x0048b480): a turret that fires a projectile every 8.3 seconds.
export type TurretData = {
  readonly keyword: 0x40
  // +0x10..+0x18: where it fires from; the instance's position (lowered by 17) replaces it every update.
  readonly position: Vector3
  // +0x38: the instance the turret sits on.
  readonly instance: InstanceReference | null
  // +0x48: milliseconds into the turret's period (+0x50); +0x4c: milliseconds since the last shot.
  readonly periodMilliseconds: number
  readonly cycleMilliseconds: number
  readonly shotMilliseconds: number
}

// 0x2e (0x0048e2a0): a rock that swaps between two meshes and a collision object.
export type RockData = {
  readonly keyword: 0x2e
  // +0x40 and +0x44: the "mmrocof" and "mmrocon" mesh instances.
  readonly offInstance: InstanceReference | null
  readonly onInstance: InstanceReference | null
  // +0x4c..+0x54: the level distances "mmrocof" had when the hazard loaded.
  readonly savedDistances: readonly number[]
  readonly collisionObjectName: string
  // +0x58: 0 asks the next update to swap the meshes.
  readonly flag: number
}

// 0x2f (0x0048e980): the snow that falls around the player.
export type SnowfallData = {
  readonly keyword: 0x2f
  // +0x14: the emitter handle of "snow", or null.
  readonly emitterHandle: number | null
  // +0x18: milliseconds since the emitter was made.
  readonly milliseconds: number
  // +0x1c
  readonly isEnabled: boolean
}

// 0x30 (0x0048e680): a vent that smokes.
export type SmokeVentData = {
  readonly keyword: 0x30
  // +0x10: "dp_def"
  readonly instance: InstanceReference | null
  // +0x18: the emitter handle of "smoke", or null.
  readonly emitterHandle: number | null
  // +0x1c: the track is mirrored.
  readonly isMirrored: boolean
}

// 0x34 (0x0048ed10): a gate of up to four parts that opens once.
export type GateData = {
  readonly keyword: 0x34
  // +0x10..+0x1c
  readonly parts: readonly (InstanceReference | null)[]
  // +0x20: the collision object that goes away when the gate opens.
  readonly collisionObjectName: string
}

// 0x33 (0x0048f6e0) and 0x3d (0x0048f200): a cannon that fires a ball.
export type CannonData = {
  readonly keyword: 0x33 | 0x3d
  // +0xe0, +0xec, +0xf8: where it fires from, where it aims and the point a signal must be near to fire it.
  readonly position: Vector3
  readonly target: Vector3
  readonly trigger: Vector3
  // +0x104: how near (squared); +0x108: the signal that fires it (-1: none).
  readonly squaredRange: number
  readonly signalIdentifier: number
  // +0x38: the ball in flight.
  readonly flight: BallisticFlight
  // 0x3d only: the choices made by the last Begin (+0x13c is the second).
  readonly firstChoice: number
  readonly secondChoice: number
}

// 0x3e (0x0048bb00): the swinging hammer's body.
export type HammerData = {
  readonly keyword: 0x3e
  // +0x1e8: the hammer's skeleton instance.
  readonly instance: InstanceReference | null
}

// 0x43 (0x0048c440): launches a cannonball from a skeleton instance at intervals.
export type PeriodicLauncherData = {
  readonly keyword: 0x43
  // +0x38
  readonly instance: InstanceReference | null
  // +0x40 and +0x3c
  readonly periodMilliseconds: number
  readonly elapsedMilliseconds: number
  // +0x10: the projectile's model name.
  readonly modelName: string
}

// 0x2d (0x0048d240): a code lock of three buttons pressed in order.
export type CodeLockData = {
  readonly keyword: 0x2d
  // +0x30..+0x32: the three signals that make the code; +0x33..+0x35: the three that spoil it.
  readonly code: readonly number[]
  readonly decoys: readonly number[]
  // +0x36: 0 nothing pressed, 1 the first button, 3 the first two.
  readonly progress: number
  // +0x38: milliseconds the lock stays open.
  readonly openMilliseconds: number
  // The index of the track world's first material animation, whose entries 5, 4 and 3 (+0x1c, +0x20, +0x24) show
  // the three buttons.
  readonly materialAnimationIndex: number
}

// 0x2b (0x0048c850): the ghost.
export type GhostData = {
  readonly keyword: 0x2b
  // +0x6c: milliseconds since the ghost last made a sound at a racer.
  readonly elapsedMilliseconds: number
  // +0x64: milliseconds since the sound pitch changed.
  readonly soundMilliseconds: number
  // +0x50: the looped sound exists.
  readonly isSoundHeld: boolean
  // +0x68: the pitch offset the last draw made.
  readonly pitchOffset: number
}

// 0x2c (0x0048d7f0): the lava monster.
export type LavaData = {
  readonly keyword: 0x2c
  // +0x48: the looped sound exists.
  readonly isSoundHeld: boolean
}

// 0x48 (0x0048dd20): a hazard that holds a racer for a moment.
export type CaptureData = {
  readonly keyword: 0x48
  // +0x38
  readonly instance: InstanceReference | null
  // +0x48 and +0x4c: between these clip times it lets go; +0x50: the third float of the file.
  readonly releaseWindow: readonly [number, number]
  // +0x44: the racer it holds.
  readonly capturedRacer: number | null
  // +0x54: milliseconds until it lets the racer go; +0x58: 0 idle, 1 holding, 2 resting; +0x5c: the phase timer.
  readonly holdMilliseconds: number
  readonly phase: number
  readonly phaseMilliseconds: number
}

// 0x32 (0x0048fe30): the crane.
export type CraneData = {
  readonly keyword: 0x32
  // +0x38
  readonly instance: InstanceReference | null
  // +0x178 bit 1: armed to announce its signal.
  readonly flags: number
  // +0x14..+0x1c (the frame at +0x10): the world point of the fourth bone, as the last update left it; the origin until then.
  readonly bone: Vector3
}

// A class that is registered but whose behaviour is not ported yet.
export type UnportedHazardData = {
  readonly keyword: 0
}

export type HazardData =
  | HammerWatcherData
  | PillarData
  | SphinxData
  | ScrollerData
  | WarpPadData
  | HazardDropperData
  | TurretData
  | RockData
  | SnowfallData
  | SmokeVentData
  | GateData
  | CannonData
  | HammerData
  | PeriodicLauncherData
  | CodeLockData
  | GhostData
  | LavaData
  | CaptureData
  | CraneData
  | UnportedHazardData
