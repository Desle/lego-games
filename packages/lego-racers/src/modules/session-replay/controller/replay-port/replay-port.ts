import { getTraceFields } from '../../../golden-trace/index.ts'
import {
  createRace,
  getRaceStateWithGrants,
  loadRaceDefinition,
  NO_MENU_INPUT,
  NO_RACE_CONTACTS,
  stepRace,
} from '../../../race/index.ts'
import type { RaceDefinition } from '../../../race/index.ts'
import { getRacerControls } from '../../../race-input/index.ts'
import type { SessionRecording } from '../../../session-recording/index.ts'
import { getReplayLoadOptions } from '../../../session-recording/index.ts'
import type { PortReplay } from './replay-port.types.ts'

// The race the recording started, loaded the way the session loaded it.
export const loadReplayDefinition = (
  recording: SessionRecording,
  jam: Uint8Array,
  executable: Uint8Array
): RaceDefinition =>
  Object.freeze({
    ...loadRaceDefinition(jam, executable, getReplayLoadOptions(recording.header, jam)),
    isCountdownSkipped: recording.header.isCountdownSkipped,
  })

// Steps the port headlessly with exactly what the viewer's race step received, frame by frame, and records the compared
// fields after each frame.
export const replayOnPort = (
  recording: SessionRecording,
  jam: Uint8Array,
  executable: Uint8Array
): PortReplay => {
  let raceState = createRace(loadReplayDefinition(recording, jam, executable))
  const frames = recording.frames.map((frame, index) => {
    const granted =
      frame.grant === null
        ? raceState
        : getRaceStateWithGrants(raceState, [{ racer: 0, ...frame.grant }])
    raceState = stepRace(
      granted,
      {
        controls: [getRacerControls(frame.input)],
        contacts: NO_RACE_CONTACTS,
        menu: frame.menu ?? NO_MENU_INPUT,
      },
      frame.milliseconds
    ).raceState
    return {
      frame: index,
      milliseconds: frame.milliseconds,
      fields: getTraceFields(raceState, recording.header.localPlayerCount),
    }
  })
  return { raceState, frames }
}
