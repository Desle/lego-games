import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { parseGhost } from '../parse-ghost/parse-ghost.ts'
import {
  beginGhostRun,
  createGhostSession,
  finishGhostRun,
  getGhostRun,
  loadChampionGhost,
} from '../ghost-session/ghost-session.ts'
import type { Ghost } from '../../types/ghost.types.ts'
import { stepGhostPlayback } from './ghost-playback.ts'

const ARITHMETIC = createFloatArithmetic(RACE_FPU_PRECISION)

const CHAMPION: Ghost = {
  firstIntegers: [30000, 30000, 30000],
  secondInteger: 0,
  startPosition: [10, 20, 30],
  startQuaternion: [0, 0, 0, 1],
  samples: [
    { position: [0, 0, 0], orientationBytes: [0, 0, 0, 127] },
    { position: [320, 640, -64], orientationBytes: [0, 0, 0, 127] },
    { position: [640, 640, 0], orientationBytes: [0, 0, 0, 127] },
  ],
  readByteCount: 0,
}

const getRunning = (elapsedMilliseconds: number) => ({
  ...beginGhostRun(loadChampionGhost(createGhostSession(false), CHAMPION)),
  elapsedMilliseconds,
})

describe('stepGhostPlayback', () => {
  it('puts the champion at its first position while the clock is stopped', () => {
    // Arrange
    const session = loadChampionGhost(createGhostSession(false), CHAMPION)

    // Act
    const step = stepGhostPlayback(ARITHMETIC, session)

    // Assert
    expect(step.champion?.position).toEqual({ x: 10, y: 20, z: 30 })
    expect(step.champion?.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    expect(step.best).toBeNull()
  })

  it('blends the two samples around the clock by the part of the interval that has passed', () => {
    // Arrange
    const session = getRunning(125)

    // Act
    const step = stepGhostPlayback(ARITHMETIC, session)

    // Assert
    expect(step.champion?.position).toEqual({ x: 5, y: 10, z: -1 })
    expect(step.champion?.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    expect(step.champion?.isFinished).toBe(false)
  })

  it('derives the wheel speed from the distance of the two samples', () => {
    // Arrange
    const session = getRunning(0)

    // Act
    const step = stepGhostPlayback(ARITHMETIC, session)

    // Assert
    const distance = Math.sqrt(10 ** 2 + 20 ** 2 + 2 ** 2)
    expect(step.champion?.speed).toBeCloseTo(distance * 4 * 1.8, 3)
  })

  it('marks the playback finished once the clock passes the last pair of samples', () => {
    // Arrange
    const session = getRunning(500)

    // Act
    const step = stepGhostPlayback(ARITHMETIC, session)
    const after = stepGhostPlayback(ARITHMETIC, step.session)

    // Assert
    expect(step.champion).toBeNull()
    expect(step.session.isChampionPlaybackFinished).toBe(true)
    expect(after.champion).toBeNull()
  })

  it('plays nothing from 240 seconds on', () => {
    // Arrange
    const session = getRunning(240000)

    // Act
    const step = stepGhostPlayback(ARITHMETIC, session)

    // Assert
    expect(step.champion).toBeNull()
    expect(step.session.isChampionPlaybackFinished).toBe(false)
  })

  it('shows the best run of the session beside the champion once one is finished', () => {
    // Arrange
    const finished = finishGhostRun(
      { ...getRunning(0), currentRun: getGhostRun(CHAMPION) },
      [29000, 30000, 30000]
    )
    const second = { ...beginGhostRun(finished), elapsedMilliseconds: 125 }

    // Act
    const step = stepGhostPlayback(ARITHMETIC, second)

    // Assert
    expect(step.best?.position).toEqual({ x: 5, y: 10, z: -1 })
    expect(step.champion).not.toBeNull()
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'plays every champion ghost of LEGO.JAM from its first sample to its last',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const ghostPaths = archive.getFilePaths().filter((path) => path.endsWith('GHOST.GHB'))

      // Act
      const reports = ghostPaths.map((path) => {
        const ghost = parseGhost(archive.readFile(path), false)
        const session = beginGhostRun(loadChampionGhost(createGhostSession(false), ghost))
        const middle = stepGhostPlayback(ARITHMETIC, {
          ...session,
          elapsedMilliseconds: Math.floor(ghost.samples.length / 2) * 250 + 100,
        })
        const end = stepGhostPlayback(ARITHMETIC, {
          ...session,
          elapsedMilliseconds: ghost.samples.length * 250,
        })
        return { path, middle, end }
      })

      // Assert
      expect(reports).toHaveLength(12)
      for (const { middle, end } of reports) {
        expect(Number.isFinite(middle.champion?.position.x)).toBe(true)
        expect(middle.champion?.speed).toBeGreaterThan(0)
        expect(end.champion).toBeNull()
        expect(end.session.isChampionPlaybackFinished).toBe(true)
      }
    }
  )
})
