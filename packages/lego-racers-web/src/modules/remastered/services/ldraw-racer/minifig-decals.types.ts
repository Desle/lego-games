import type { Mesh } from 'three'
import type { DriverFilePart } from './driver-file.types.ts'

export type MinifigDecal = {
  readonly mesh: Mesh
  // Resolves when the texture pack's picture has replaced the original's, or when the pack has none.
  readonly settled: Promise<void>
}

// A decal and the part of a driver file it is painted on.
export type PlacedDecal = {
  readonly decal: MinifigDecal
  readonly entry: DriverFilePart
}
