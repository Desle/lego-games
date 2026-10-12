import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { parseRecording } from '../../../session-recording/index.ts'
import { REPLAYS_DIRECTORY } from '../replay-folder/replay-folder.ts'
import { replayOnPort } from './replay-port.ts'

const REPLAY_TIMEOUT_MILLISECONDS = 120_000
const WARPING_FLAG = 0x10
const DOOR_OPEN_FRAME = 5_800
const LANDING_FRAME = 5_850
const DESTINATION_X = 132.67
const LANDING_TOLERANCE = 60

const getFloat = (bits: number | undefined): number =>
  new Float32Array(new Uint32Array([bits ?? 0]).buffer)[0] ?? 0

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent()

describe('replayOnPort: the warp pad of the final race (RACEC3R0)', () => {
  // The player shoots the door open (frame 5645), drives through it and crosses the "warptrig" plane behind it.
  it.skipIf(!getIsGamePresent())(
    'carries the player through the opened door to the pad destination',
    () => {
      // Arrange
      const recording = parseRecording(
        readFileSync(resolve(REPLAYS_DIRECTORY, 'racec3r0-warp-pad.replay.jsonl'), 'utf8')
      )

      // Act
      const replay = replayOnPort(recording, readOriginalJam(), readOriginalExecutable())

      // Assert
      const warpingFrames = replay.frames
        .slice(DOOR_OPEN_FRAME - 100, LANDING_FRAME)
        .filter((frame) => ((frame.fields['racer0.racer.flags']?.[0] ?? 0) & WARPING_FLAG) !== 0)
      const landed = replay.frames[LANDING_FRAME]?.fields['racer0.body.position']
      expect(warpingFrames.length).toBeGreaterThan(0)
      expect(Math.abs(getFloat(landed?.[0]) - DESTINATION_X)).toBeLessThan(LANDING_TOLERANCE)
    },
    REPLAY_TIMEOUT_MILLISECONDS
  )
})
