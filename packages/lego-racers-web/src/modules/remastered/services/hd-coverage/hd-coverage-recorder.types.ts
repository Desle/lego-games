import type { Object3D } from 'three'
import type { ViewerExtension } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { HookCall } from './hd-coverage.types.ts'

// The calls of the drawing hooks since the last reset, with the objects of the drawings they returned.
export type CoverageRecorder = {
  readonly reset: () => void
  readonly getCalls: () => readonly HookCall[]
  // The call whose drawing an object is (or is inside), or null.
  readonly getCallId: (object: Object3D) => number | null
  // The calls whose drawing has neither a mesh yet nor failed.
  readonly getUnsettledCallIds: () => readonly number[]
}

export type RecordingExtension = {
  readonly extension: ViewerExtension
  readonly recorder: CoverageRecorder
}
