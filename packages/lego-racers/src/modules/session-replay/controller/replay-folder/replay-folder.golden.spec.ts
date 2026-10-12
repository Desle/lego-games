import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getIsOriginalTraceAvailable } from '../../../golden-trace/index.ts'
import { parseRecording } from '../../../session-recording/index.ts'
import { runReplay } from '../run-replay/run-replay.ts'
import { getExpectationOfReport, readStoredReplays } from './replay-folder.ts'

const REPLAY_TIMEOUT_MILLISECONDS = 1_800_000

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

describe('golden trace: the recorded sessions of reverse-engineering/replays', () => {
  it('has recordings to replay', () => {
    // Arrange
    const replays = readStoredReplays()

    // Act
    const names = replays.map((replay) => replay.name)

    // Assert
    expect(names.length).toBeGreaterThan(0)
  })

  for (const replay of readStoredReplays()) {
    it.skipIf(!getIsGamePresent())(
      `${replay.name} diverges where its expectation says`,
      async () => {
        // Arrange
        const recording = parseRecording(replay.text)

        // Act
        const report = await runReplay(
          recording,
          readOriginalJam(),
          readOriginalExecutable(),
          replay.name
        )

        // Assert
        expect(getExpectationOfReport(report)).toEqual(replay.expectation)
      },
      REPLAY_TIMEOUT_MILLISECONDS
    )
  }
})
