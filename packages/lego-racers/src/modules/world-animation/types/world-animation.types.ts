import type { MaterialAnimation } from '../../material-animation/index.ts'
import type {
  SkeletalAnimation,
  SkeletonAnimationState,
  Vector3,
} from '../../skeletal-animation/index.ts'
import type { World } from '../../world/index.ts'

// A skeleton instance of a world as the race moves it (GolDP.dll class 0x10023420, 0xf4 bytes).
export type SkeletonInstanceRuntime = {
  readonly name: string
  // Instance +0xa8: the animation of the nearest level; null for a camera's skeleton without one.
  readonly animation: SkeletalAnimation | null
  // +0xb4..+0xf0; null while the instance has no clip.
  readonly clip: SkeletonAnimationState | null
  // Flag 0x10000 of +0x5c: the update advances the clip.
  readonly isAnimated: boolean
  // The other bits of +0x5c that the port keeps as they are (2 and 4 from the world's keywords 0x42 and 0x4c).
  readonly otherFlags: number
  // Frame +0x4c..: the instance's position, moved by the clip's velocity.
  readonly position: Vector3
  // +0x84, +0x88, +0x8c: the squared distance each level shows up to (the largest float: always).
  readonly levelSquaredDistances: readonly number[]
}

// A mesh instance (class 0x10027b50).
export type MeshInstanceRuntime = {
  readonly name: string
  readonly position: Vector3
  readonly levelSquaredDistances: readonly number[]
  readonly otherFlags: number
}

// One 0x18-byte entry of a material animation, as the race plays it (exe 0x004104c0; GolDP.dll 0x10025da0 starts the
// ones an instance refers to, looping).
export type MaterialAnimationPlayback = {
  // Flag 2 of +0x14: the entry advances; flag 4: it loops.
  readonly isPlaying: boolean
  readonly isLooping: boolean
  // +0x10: time in animation frames.
  readonly time: number
  // The row of the animation's table the time selects (0x00410750 writes its value into the material); null before
  // the first advance.
  readonly tableIndex: number | null
}

export type MaterialAnimationRuntime = {
  // The name in the world's list (world +0x78, eight characters).
  readonly name: string
  readonly definition: MaterialAnimation
  readonly entries: readonly MaterialAnimationPlayback[]
}

export type WorldAnimation = {
  readonly skeletonInstances: readonly SkeletonInstanceRuntime[]
  readonly meshInstances: readonly MeshInstanceRuntime[]
  readonly materialAnimations: readonly MaterialAnimationRuntime[]
}

// The three worlds Race_Update animates: the track (race +0x390), the blended world (+0x398) and the local world
// (+0x3a4).
export type RaceWorlds = {
  readonly track: WorldAnimation
  readonly blended: WorldAnimation
  readonly local: WorldAnimation
}

// What a world's animation is made from: the parsed WDB and the files its name lists resolve to.
export type WorldAnimationInput = {
  readonly world: World
  // In the order of `world.animations`.
  readonly animations: readonly SkeletalAnimation[]
  // In the order of `world.materialAnimations`.
  readonly materialAnimations: readonly MaterialAnimation[]
}

export type InstanceLevel = {
  readonly animationIndex: number
  readonly squaredDistance: number
}
