import type { MaterialAnimation } from '../../material-animation/index.ts'
import type {
  SkeletalAnimation,
  SkeletonAnimationState,
  Vector3,
} from '../../skeletal-animation/index.ts'
import type { Matrix3 } from '../../simulation-math/index.ts'
import type { Skeleton } from '../../skeleton/index.ts'
import type { World } from '../../world/index.ts'

// A skeleton instance of a world as the race moves it (GolDP.dll class 0x10023420, 0xf4 bytes).
export type SkeletonInstanceRuntime = {
  readonly name: string
  // Instance +0xa8: the animation of the nearest level; null for a camera's skeleton without one.
  readonly animation: SkeletalAnimation | null
  // Frame +0x28: the rotation 0x10026b50 builds from the instance's forward and up vectors.
  readonly rotation: Matrix3
  // The scale of the nearest level's model (mesh +0x38) with the instance's own (+0x58, 1): the bones' positions are scaled
  // by it (0x0045ebe0).
  readonly scale: number
  // The bounding radius of the nearest level's model (mesh +0x34, scale applied): 0 for a model without vertices.
  readonly boundsRadius: number
  // The skeleton of the nearest level; null for a camera's skeleton without one.
  readonly skeleton: Skeleton | null
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

// Where the camera lock (0x004047b0) puts the camera: its position and the forward and up vectors it is given.
export type SkeletonInstanceCameraView = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly forward: { readonly x: number; readonly y: number; readonly z: number }
  readonly up: { readonly x: number; readonly y: number; readonly z: number }
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

// A world camera (file keyword 0x43, GolDP.dll 0x1002dc80) as the race's name lookup (race +0x3ac, 0x00432e20) hands it
// to the camera lock: its skeleton instance (0x2f, first int) and the bone of that instance (0x2f, second int).
export type WorldCameraRuntime = {
  readonly name: string
  readonly skeletonInstanceIndex: number
  readonly boneIndex: number
}

export type WorldAnimation = {
  readonly skeletonInstances: readonly SkeletonInstanceRuntime[]
  readonly cameras: readonly WorldCameraRuntime[]
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
  // In the order of `world.skeletons`.
  readonly skeletons?: readonly Skeleton[]
  // The scale of each model of `world.meshes` that a skeleton instance uses (1 for the others).
  readonly meshScales?: readonly number[]
  // The bounding radius (model +0x34) of the same models (0 for the others).
  readonly meshRadii?: readonly number[]
  // In the order of `world.materialAnimations`.
  readonly materialAnimations: readonly MaterialAnimation[]
  // A mirrored race (Race_LoadTrackContent's flag): 0x00416140 negates the y of every instance's position (0x00411040).
  readonly isMirrored?: boolean
}

// What the mirror needs of an instance: its position.
export type PositionedInstance = {
  readonly position: Vector3
}

export type InstanceLevel = {
  readonly animationIndex: number
  readonly skeletonIndex: number
  readonly meshIndex: number
  readonly squaredDistance: number
}
