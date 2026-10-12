import type { Mesh } from 'three'

export type MinifigDecal = {
  readonly mesh: Mesh
  // Resolves when the texture pack's picture has replaced the original's, or when the pack has none.
  readonly settled: Promise<void>
}
