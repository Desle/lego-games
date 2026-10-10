import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parsePowerUps } from '../../../power-up/index.ts'
import { createRandomTable, loadRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickKind } from '../../types/brick-kind/brick-kind.ts'
import { BrickState } from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type { RacerPowerUpStatus } from '../../types/power-ups.types.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import {
  createPowerUpWorld,
  touchEnhancementBricks,
  touchPowerUpBricks,
  updatePowerUps,
} from './power-up-world.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const STATUS: RacerPowerUpStatus = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 1, y: 0, z: 0 },
  isComputer: false,
  isShielded: false,
  shieldLevel: 0,
  isTumbling: false,
  isWarping: false,
  isCursed: false,
  isWarpWithheld: false,
  isWarpPending: false,
  isAirborne: false,
  isStruckByLightning: false,
  isInTurbo: false,
}

const CONTEXT: PowerUpContext = {
  arithmetic: SINGLE,
  racers: [STATUS, STATUS],
  raceModeFlags: 0,
  getGroundPoint: () => null,
  trackTargets: [],
}

const createStep = (): PowerUpStep =>
  createPowerUpWorld({
    bricks: [{ position: [0, 0, 0], kind: 1, identifier: -1 }],
    enhancementBricks: [{ position: [0, 0, 0] }],
    raceModeFlags: 0,
    isSplitScreen: false,
    racers: [
      { voiceSoundBase: 0, voiceCooldownMilliseconds: 0 },
      { voiceSoundBase: 0, voiceCooldownMilliseconds: 0 },
    ],
    random: { table: createRandomTable(Array.from({ length: 1024 }, () => 0)), position: 0 },
  })

describe('createPowerUpWorld', () => {
  it('makes 20 draws for each of the three one-screen wands (0x004548f0)', () => {
    // Arrange
    const definitionPosition = 0

    // Act
    const step = createStep()

    // Assert
    expect(step.world.random.position).toBe(definitionPosition + 60)
    expect(step.world.bricks[0]?.kind).toBe(BrickKind.PROJECTILE)
  })

  it.skipIf(!getIsOriginalJamPresent() || !getIsOriginalExecutablePresent())(
    'loads the Royal Knights bricks and the executable’s random table',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const path = archive
        .getFilePaths()
        .find((candidate) => candidate.endsWith('RACEC0R0\\POWERUP.PWB'))
      const placements = parsePowerUps(archive.readFile(path ?? ''), false)

      // Act
      const step = createPowerUpWorld({
        bricks: placements.bricks,
        enhancementBricks: placements.enhancementBricks,
        raceModeFlags: 0,
        isSplitScreen: false,
        racers: [],
        random: { table: loadRandomTable(readOriginalExecutable()), position: 0 },
      })

      // Assert
      expect([step.world.bricks.length, step.world.enhancementBricks.length]).toEqual([27, 12])
      expect(step.world.bricks.every((brick) => brick.state === BrickState.HIDDEN)).toBe(true)
      expect(step.world.random.position).toBe(60)
    }
  )
})

describe('updatePowerUps', () => {
  it('spins the bricks by 0.004 rad/ms and wraps past 2π (0x0045a490)', () => {
    // Arrange
    const step = createStep()

    // Act
    const once = updatePowerUps(step, CONTEXT, 100)
    const wrapped = [...Array.from({ length: 15 }, () => 100)].reduce(
      (current, stepMilliseconds) => updatePowerUps(current, CONTEXT, stepMilliseconds),
      once
    )

    // Assert
    expect(once.world.brickSpinAngle).toBe(Math.fround(100 * Math.fround(0.004)))
    expect(wrapped.world.brickSpinAngle).toBeLessThan(Math.fround(2 * Math.PI))
  })
})

describe('touchPowerUpBricks and touchEnhancementBricks', () => {
  it('collects available bricks; the second racer finds them gone', () => {
    // Arrange
    const ready = updatePowerUps(updatePowerUps(createStep(), CONTEXT, 1), CONTEXT, 501)

    // Act
    const bricks = touchPowerUpBricks(ready, CONTEXT, [
      { racer: 0, brick: 0 },
      { racer: 1, brick: 0 },
    ])
    const enhancements = touchEnhancementBricks(bricks, CONTEXT, [
      { racer: 1, brick: 0 },
      { racer: 0, brick: 0 },
    ])

    // Assert
    expect(bricks.world.racers.map((racer) => racer.heldBrickKind)).toEqual([
      BrickKind.PROJECTILE,
      null,
    ])
    expect(enhancements.world.racers.map((racer) => racer.enhancementLevel)).toEqual([0, 1])
    expect(enhancements.world.enhancementBricks[0]?.state).toBe(BrickState.COLLECTED)
  })
})
