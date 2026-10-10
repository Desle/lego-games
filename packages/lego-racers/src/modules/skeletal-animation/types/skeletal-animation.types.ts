export type Vector3 = readonly [number, number, number]

// The 3×3 of a bone (0x10002e30): row 0 at bone +0x10, row 1 at +0x20, row 2 at +0x30; row vectors multiply from the left.
export type BoneRotation = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

// A bone's local transform: the rotation matrix (bone +0x10..+0x38) and the translation (+0x40..+0x48).
export type BoneTransform = {
  readonly rotation: BoneRotation
  readonly translation: Vector3
}

export type SkeletalPose = {
  readonly bones: readonly BoneTransform[]
}

// The bone rows of the engine's 4×4 matrices, bone after bone: 16 float32 values each, row-major, row vectors.
export type BoneMatrices = Float32Array

// What sampling one track at one time gives: nothing when the track has no keys (0x10024380, 0x10024540).
export type PositionSample = Vector3 | null
export type RotationSample = readonly [number, number, number, number] | null

// One of the two clips a skeleton instance plays: the first (instance +0xb4.., +0xbc) and the second (+0xd0.., +0xd8).
export type PlayingClip = {
  readonly clipIndex: number
  // Frames into the clip (+0xb4 / +0xd0), float32.
  readonly timeInFrames: number
  // Frames per millisecond: the clip's keyword 0x2f value (+0xb8 / +0xd4).
  readonly framesPerMillisecond: number
  // The clip's keyword 0x30 vector (+0xc0.. / +0xdc..).
  readonly velocity: Vector3
}

// The animation state of a skeleton instance (offsets in the instance, GolDP.dll 0x10023b10). The flag bits are
// named booleans: 0x40000 the first clip loops, 0x80000 it has finished, 0x100000 it continues with the second
// clip's index at the end, 0x400000 the second clip loops, 0x2000000 it wrapped during the last update, 0x20000
// the instance blends from the first clip to the second.
export type SkeletonAnimationState = {
  readonly clip: PlayingClip
  readonly secondClip: PlayingClip
  readonly isLooping: boolean
  readonly isFinished: boolean
  readonly isWrapped: boolean
  readonly isContinuingWithSecondClip: boolean
  readonly isSecondLooping: boolean
  readonly isBlending: boolean
  // +0xcc and +0xe8: which clips keep advancing during a blend.
  readonly isFirstAdvancing: boolean
  readonly isSecondAdvancing: boolean
  // +0xec, from 0 to 1, and its change per millisecond +0xf0.
  readonly blendFactor: number
  readonly blendFactorPerMillisecond: number
  // The instance's +0x1c vector, added to the position by dt each update.
  readonly velocity: Vector3
}

// The animation as the pose sampling reads it: the shared key pools, the per-bone tracks and the clips.
export type AnimationTrack = {
  readonly rotationStart: number
  readonly rotationTimeStart: number
  readonly rotationCount: number
  readonly positionStart: number
  readonly positionTimeStart: number
  readonly positionCount: number
}

export type AnimationClip = {
  readonly name: string
  readonly framesPerMillisecond: number
  readonly velocity: Vector3
  readonly firstTrackIndex: number
  // +0x24: frames in the clip (the last frame is one less).
  readonly frameCount: number
  // +0x26: the length a looping clip wraps at.
  readonly loopLength: number
}

export type SkeletalAnimation = {
  readonly positions: readonly Vector3[]
  readonly rotations: readonly (readonly [number, number, number, number])[]
  // The uint16 key times, shared by position and rotation tracks.
  readonly times: readonly number[]
  readonly tracks: readonly AnimationTrack[]
  readonly clips: readonly AnimationClip[]
}

// The time and frame count a clip is sampled at (0x10023646..0x100236d6): a looping clip wraps its time and uses
// its loop length (+0x26), a clip that does not loop uses the time as it is and its frame count (+0x24).
export type SampledClip = {
  readonly clip: AnimationClip
  readonly time: number
  readonly frameCount: number
}

// Where a time falls between the keys of one track: the keys to blend (indices relative to the track's first
// key) and how far.
export type KeyInterval = {
  readonly previousKey: number
  readonly nextKey: number
  readonly fraction: number
}

// A blend step: the state after the factor moved, and the milliseconds left for the first clip to advance.
export type BlendStep = {
  readonly state: SkeletonAnimationState
  readonly deltaMilliseconds: number
}
