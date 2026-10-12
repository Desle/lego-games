import type { RaceStart } from '@lego-games/lego-racers/game-session'
import {
  createReplayHeader,
  createReplayRecorder,
  serializeRecording,
} from '@lego-games/lego-racers/session-recording'
import {
  getExtensionSelections,
  getIsClassic,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { sessionRecordingStore } from '../session-recording-store/session-recording-store.ts'
import type { SessionRecordingStore } from '../session-recording-store/session-recording-store.types.ts'
import { postRecordingToInbox } from '../replay-inbox-upload/replay-inbox-upload.ts'
import type { InboxPoster, RaceRecording } from './race-recording.types.ts'

const FILE_EXTENSION = '.replay.jsonl'

// Records what feeds the deterministic simulation of the race that starts: the settings, the cars, the random cursor and
// per frame the integer time and the input state. With an extension registered the header says so: drawing and sound
// change, the simulation does not.
export const createRaceRecording = (
  start: RaceStart,
  store: SessionRecordingStore = sessionRecordingStore,
  postToInbox: InboxPoster = postRecordingToInbox
): RaceRecording | null => {
  const header = createReplayHeader(start, getIsClassic() ? null : getExtensionSelections())
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
      const fileName = `${header.raceFolder}-${stamp}${FILE_EXTENSION}`
      const text = serializeRecording(recorder.finish())
      await store.save(fileName, text)
      await postToInbox(fileName, text)
    },
  })
}
