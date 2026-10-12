import type { RaceStart } from '@lego-games/lego-racers/game-session'
import {
  createReplayHeader,
  createReplayRecorder,
  serializeRecording,
} from '@lego-games/lego-racers/session-replay'
import { getIsHighDefinitionEnabled } from '../scene-object/high-definition-texture/high-definition-texture.ts'
import { sessionRecordingStore } from '../session-recording-store/session-recording-store.ts'
import type { SessionRecordingStore } from '../session-recording-store/session-recording-store.types.ts'
import type { RaceRecording } from './race-recording.types.ts'

const FILE_EXTENSION = '.replay.jsonl'

// Records what feeds the deterministic simulation of the race that starts: the settings, the cars, the random cursor and
// per frame the integer time and the input state. Never in the high-definition view (`?hd`): only the classic view is
// the game the port reproduces.
export const createRaceRecording = (
  start: RaceStart,
  search: string,
  store: SessionRecordingStore = sessionRecordingStore
): RaceRecording | null => {
  if (getIsHighDefinitionEnabled(search)) return null
  const header = createReplayHeader(start)
  if (header === null) return null
  const recorder = createReplayRecorder(header)
  let isFinished = false
  return Object.freeze({
    addFrame: recorder.addFrame,
    finish: async () => {
      if (isFinished) return
      isFinished = true
      if (recorder.getFrameCount() === 0) return
      const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
      await store.save(
        `${header.raceFolder}-${stamp}${FILE_EXTENSION}`,
        serializeRecording(recorder.finish())
      )
    },
  })
}
