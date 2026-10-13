import type { Box3, Vector3 } from 'three'
import type { FidelityAnchorResult } from './ldraw-fidelity.types.ts'

// A corner of the original's skeleton mesh where the pose puts it (world, studs), and the bone that moves it.
export type BonePoint = {
  readonly boneIndex: number
  readonly point: Vector3
}

// The same region of the original and of the replacement, in the world.
export type BoundsPair = {
  readonly original: Box3
  readonly replacement: Box3
}

// A driver's attachment points, and the regions a catalogue part is measured in (null when one side has no such region).
export type DriverMeasures = {
  readonly anchors: readonly FidelityAnchorResult[]
  readonly regions: Readonly<Record<DriverRegion, BoundsPair | null>>
}

// The regions of a figure a catalogue part is measured in.
export type DriverRegion = 'head' | 'torso' | 'seat'
