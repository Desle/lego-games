import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getGhostRun } from '../ghost-session/ghost-session.ts'
import { parseGhost } from '../parse-ghost/parse-ghost.ts'
import type { GhostRun } from '../../types/ghost-run/ghost-run.types.ts'
import { encodeGhost } from './encode-ghost.ts'

const RUN: GhostRun = {
  lapMilliseconds: [30000, 31000, 32000],
  samples: [
    { position: [100, -200, 300], orientationBytes: [1, 2, 3, 127] },
    { position: [110, -190, 305], orientationBytes: [255, 250, 3, 100] },
  ],
  secondInteger: 4,
  startPosition: [3.5, -4.25, 5],
  startQuaternion: [0, 0.5, 0, 0.5],
}

describe('encodeGhost', () => {
  it('writes a file parseGhost reads back', () => {
    // Arrange
    const bytes = encodeGhost(RUN, false)

    // Act
    const parsed = parseGhost(bytes, false)

    // Assert
    expect(getGhostRun(parsed)).toEqual(RUN)
    expect(parsed.readByteCount).toBe(bytes.byteLength)
  })

  it('stores a run of a mirrored track the way the mirrored loader undoes', () => {
    // Arrange
    const bytes = encodeGhost(RUN, true)

    // Act
    const asStored = parseGhost(bytes, false)
    const asLoaded = parseGhost(bytes, true)

    // Assert
    expect(asStored.samples[0]?.position).toEqual([100, 200, 300])
    expect(getGhostRun(asLoaded)).toEqual(RUN)
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'writes back the champion ghosts of LEGO.JAM as the same runs',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.endsWith('GHOST.GHB'))

      // Act
      const runs = paths.map((path) => getGhostRun(parseGhost(archive.readFile(path), false)))
      const rewritten = runs.map((run) => getGhostRun(parseGhost(encodeGhost(run, false), false)))

      // Assert
      expect(runs).toHaveLength(12)
      expect(rewritten).toEqual(runs)
    }
  )
})
