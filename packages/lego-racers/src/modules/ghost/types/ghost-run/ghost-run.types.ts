import type {
  Matrix3,
  Quaternion as MathQuaternion,
  Vector3 as MathVector3,
} from '../../../simulation-math/index.ts'
import type { GhostSample, Quaternion, Vector3 } from '../ghost.types.ts'

// One of the ghost object's 0x25c0-byte buffers: the lap times of the run, its samples and the first sample's full
// position and orientation (Ghost_Load fills it from a file, GhostRecorder_RecordSample from a race).
export type GhostRun = {
  // +0x00..+0x08.
  readonly lapMilliseconds: readonly number[]
  // +0x0c, 10 bytes each; the count is +0x2598.
  readonly samples: readonly GhostSample[]
  // +0x259c: read from the file (keyword 0x2b), 0 in a recorded run.
  readonly secondInteger: number
  // +0x25a0.. and +0x25ac..
  readonly startPosition: Vector3
  readonly startQuaternion: Quaternion
}

// The ghost object (race session +0x3400): three runs and the clocks. Its flag byte +0x3b4 is spelled out.
export type GhostSession = {
  // +0x0c, from GHOST.GHB of the race's folder; null when the race has none (flag 0x08 clear).
  readonly championRun: GhostRun | null
  // +0x10: the fastest run finished in this session; null before the first.
  readonly bestRun: GhostRun | null
  // +0x14: the run being recorded.
  readonly currentRun: GhostRun
  // +0x3b0: milliseconds of the running clock.
  readonly elapsedMilliseconds: number
  // +0x3ac: milliseconds until the next sample.
  readonly sampleTimerMilliseconds: number
  // Flag 0x02: the clock runs and samples are recorded.
  readonly isRunning: boolean
  // Flag 0x01: the best run of this session plays beside the champion.
  readonly isBestRunShown: boolean
  // Flag 0x10: a run of this session was finished.
  readonly isRunFinished: boolean
  // Flag 0x20: the track is mirrored (settings +0x3c of the first race).
  readonly isMirrored: boolean
  // +0x25bc of the champion run and of the best run: playback has reached the last sample.
  readonly isChampionPlaybackFinished: boolean
  readonly isBestPlaybackFinished: boolean
}

// What GhostRecorder_RecordSample reads from the racer: the model frame's position (racer +0x5c, vtable +4) and
// the rotation matrix at +0x28 of it.
export type GhostPose = {
  readonly position: MathVector3
  readonly rotation: Matrix3
}

// What FUN_00422960 sets on a ghost car for the current time.
export type GhostPlaybackPose = {
  readonly position: MathVector3
  readonly orientation: MathQuaternion
  // The integer FUN_00422960 stores in the first model (+0xb8): the distance of the two samples · 4 · 1.8.
  readonly speed: number
  // True when the clock is past the last pair of samples (the run's flag +0x25bc is set).
  readonly isFinished: boolean
}

export type GhostRunSelection = 'champion' | 'best'
