import type {
  ReplayFrame,
  ReplayHeader,
  ReplayRecorder,
  SessionRecording,
} from '../../types/session-replay.types.ts'

// The frames are appended as they arrive: a race is minutes long and copying the list per frame would not scale.
export const createReplayRecorder = (header: ReplayHeader): ReplayRecorder => {
  const frames: ReplayFrame[] = []
  return Object.freeze({
    addFrame: (frame) => void frames.push(frame),
    getFrameCount: () => frames.length,
    finish: (): SessionRecording => Object.freeze({ header, frames: Object.freeze([...frames]) }),
  })
}
