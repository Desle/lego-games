import type { GhostPlaybackPose, GhostSession } from '../../types/ghost-run/ghost-run.types.ts'

export type GhostPlaybackStep = {
  readonly session: GhostSession
  // The pose of each ghost car, or null when it is not shown (no run, or its playback has ended).
  readonly best: GhostPlaybackPose | null
  readonly champion: GhostPlaybackPose | null
}
