import type { BoundingSphere } from '../../../racer-collision/index.ts'

// The children of a racer's collision volume (0x00440030), each sphere in world space; null where the racer has none.
export type RacerVolumeParts = {
  readonly body: BoundingSphere | null
  readonly second: BoundingSphere | null
  readonly wheels: BoundingSphere
  readonly driver: BoundingSphere
}
