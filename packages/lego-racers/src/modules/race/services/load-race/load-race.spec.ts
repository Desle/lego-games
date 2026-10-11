import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { loadRaceDefinition } from './load-race.ts'
import { UnknownRaceError } from './load-race-errors.ts'

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent()

describe('loadRaceDefinition', () => {
  it.skipIf(!getIsGamePresent())(
    'puts the circuit drivers of Royal Knights Raceway behind the player, each with its champion car',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const definition = loadRaceDefinition(jam, executable)

      // Assert
      expect(definition.racers.map(({ controllerKind }) => controllerKind)).toEqual([
        0, 2, 2, 2, 2, 2,
      ])
      // KK, IL, RK, CC and TC are circuit c1's codes 1 to 5 (LEGORACE.CRB); the player takes code 0's slot.
      expect(definition.racers.map(({ voiceBase }) => voiceBase)).toEqual([
        1000,
        6 * 12 + 0x44c,
        1 * 12 + 0x44c,
        2 * 12 + 0x44c,
        1 * 12 + 0x44c,
        5 * 12 + 0x44c,
      ])
      expect(definition.racers[1]?.personalityBytes).toEqual([10, 100, 80, 20, 60, 70])
      expect(definition.racers[3]?.personalityBytes).toEqual([40, 50, 40, 30, 20, 30])
      expect(definition.racers[1]).toMatchObject({
        preferredPowerUpKind: 'shield',
        preferredPowerUpLevel: 0,
      })
    }
  )

  it.skipIf(!getIsGamePresent())(
    'draws each computer racer from its champion body, chassis wheels and own driver, and the player from bricks',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const definition = loadRaceDefinition(jam, executable)

      // Assert
      const [player, king] = definition.racers
      expect(player?.appearance.bodyModel).toBeNull()
      expect(player?.appearance.driverModel).toBeNull()
      expect(player?.appearance.wheelModel.modelName).toBe('dajmw')
      expect(king?.appearance.bodyModel?.modelName).toBe('kkcm')
      expect(king?.appearance.wheelModel).toMatchObject({
        modelName: 'kkjmw',
        skeletonName: 'kkjmw',
        animationName: 'kkjmw',
      })
      expect(king?.appearance.driverModel).toMatchObject({
        modelName: 'kkpelvis',
        skeletonName: 'pelvis',
        animationName: 'pelvis',
      })
      expect(king?.appearance.seatPoint.z).toBeCloseTo(2.12, 2)
      expect(king?.appearance.shadowImageName).toBe('carshad1')
    }
  )

  it.skipIf(!getIsGamePresent())(
    'binds the wheels to their two animations and the driver to his 18, as the vehicle set-up leaves them',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const definition = loadRaceDefinition(jam, executable)

      // Assert
      const king = definition.racers[1]
      expect(king?.figures.wheels.animations).toHaveLength(2)
      expect(king?.figures.wheels).toMatchObject({ currentId: 0, flags: 0x50000 })
      expect(king?.figures.driver.animations).toHaveLength(18)
      expect(king?.figures.driver).toMatchObject({ currentId: 9, flags: 0x50000 })
      expect(king?.figures.wheels.child?.radiusScale).toBe(0.015625)
    }
  )

  it.skipIf(!getIsGamePresent())(
    'takes the ground probe radius from the wheels animation bounds times the model scale',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const definition = loadRaceDefinition(jam, executable)

      // Assert
      const [player, king] = definition.racers
      expect(player?.carBody.rigidBody.displayBoundingRadius).toBeCloseTo(329.1226 / 64, 3)
      expect(king?.carBody.rigidBody.displayBoundingRadius).toBeCloseTo(349.77008 / 64, 3)
    }
  )

  it.skipIf(!getIsGamePresent())(
    'builds each car body from its chassis: the champion mass and the three rating scales',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const definition = loadRaceDefinition(jam, executable)

      // Assert
      const [player, king] = definition.racers
      // The chassis's 2,500 and the 214 unit cells of the default car's bricks (car-builder).
      expect(player?.carBody.rigidBody.mass).toBe(2714)
      expect(king?.carBody.rigidBody.mass).toBe(4500)
      expect(king?.carBody.rigidBody.localCentreOfMass).toEqual({ x: -1, y: 0, z: -1 })
      expect(king?.carBody.steeringScale).toBeCloseTo(0.7 + 60 * 0.003, 6)
      expect(king?.carBody.throttleScale).toBeCloseTo(1.03, 6)
      expect(king?.carBody.topSpeedScale).toBe(1)
      expect(king?.carBody.rigidBody.topSpeed).toBe(120)
      expect(king?.carBody.rigidBody.wheelbase).toBeCloseTo(2.9815, 4)
      expect(king?.carBody.rigidBody.trackWidth).toBeCloseTo(3.9778, 4)
    }
  )

  it.skipIf(!getIsGamePresent())(
    'starts the player on its grid slot and the computer racers on their routes',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const definition = loadRaceDefinition(jam, executable)

      // Assert
      const [player, king] = definition.racers
      const slotZero = definition.startPositions.find(({ slot }) => slot === 0)
      expect(player?.route).toBeNull()
      expect(king?.route).not.toBeNull()
      expect(player?.carBody.rigidBody.frame.position).toEqual({
        x: slotZero?.position?.[0],
        y: slotZero?.position?.[1],
        z: slotZero?.position?.[2],
      })
    }
  )

  it.skipIf(!getIsGamePresent())(
    'moves racer 0 to start slot 2 when two players share the screen',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const definition = loadRaceDefinition(jam, executable, { localPlayerCount: 2 })

      // Assert
      const slotTwo = definition.startPositions.find(({ slot }) => slot === 2)
      expect(definition.racers.map(({ controllerKind }) => controllerKind)).toEqual([
        0, 0, 2, 2, 2, 2,
      ])
      expect(definition.racers[0]?.carBody.rigidBody.frame.position.x).toBe(slotTwo?.position?.[0])
    }
  )

  it.skipIf(!getIsGamePresent())(
    'gives a demonstration the circuit drivers from racer 0 on',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const definition = loadRaceDefinition(jam, executable, { localPlayerCount: 0 })

      // Assert
      expect(definition.racers[0]?.carBody.rigidBody.mass).toBe(4500)
      expect(definition.racers[0]?.voiceBase).toBe(6 * 12 + 0x44c)
    }
  )

  it.skipIf(!getIsGamePresent())(
    'takes the driver codes and the player cars from the options',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const options = {
        racerCodes: ['GM', 'BB'],
        playerCars: [{ chassisName: 'kkchas0', weight: 100, centreOffsetX: 0, centreOffsetY: 0 }],
      }

      // Act
      const definition = loadRaceDefinition(jam, executable, options)

      // Assert
      expect(definition.racers).toHaveLength(2)
      expect(definition.racers[0]?.carBody.rigidBody.mass).toBe(2600)
      expect(definition.racers[1]?.personalityBytes).toEqual([90, 20, 90, 60, 80, 90])
    }
  )

  it.skipIf(!getIsGamePresent())('stops at a race folder that LEGORACE.RCB does not list', () => {
    // Arrange
    const jam = readOriginalJam()
    const executable = readOriginalExecutable()

    // Act
    const load = () => loadRaceDefinition(jam, executable, { raceFolder: 'RACEC9R9' })

    // Assert
    expect(load).toThrow(UnknownRaceError)
  })

  it.skipIf(!getIsGamePresent())(
    'negates the y of the track data when the race is mirrored and keeps the options it was given',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()

      // Act
      const forward = loadRaceDefinition(jam, executable)
      const mirrored = loadRaceDefinition(jam, executable, {
        isMirrored: true,
        multiplayerLapCount: 2,
        isPointsRecordPresent: true,
        musicTuneCount: 0,
      })

      // Assert
      expect(forward.isMirrored).toBe(false)
      expect(mirrored.isMirrored).toBe(true)
      expect(mirrored.multiplayerLapCount).toBe(2)
      expect(mirrored.isPointsRecordPresent).toBe(true)
      expect(forward.musicTuneCount).toBe(7)
      expect(mirrored.musicTuneCount).toBe(0)
      expect(mirrored.startPositions[0]?.position?.[1]).toBe(
        -(forward.startPositions[0]?.position?.[1] ?? 0)
      )
      expect(mirrored.startPositions[0]?.position?.[0]).toBe(
        forward.startPositions[0]?.position?.[0]
      )
    }
  )

  it.skipIf(!getIsGamePresent())(
    'mirrors the frames of the collision world instances (0x00411040)',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const options = { raceFolder: 'RACEC0R1', musicTuneCount: 0 }

      // Act
      const forward = loadRaceDefinition(jam, executable, options)
      const mirrored = loadRaceDefinition(jam, executable, { ...options, isMirrored: true })

      // Assert
      const forwardFrames = forward.collisionObjects.map(({ frame }) => frame.position)
      const mirroredFrames = mirrored.collisionObjects.map(({ frame }) => frame.position)
      expect(forwardFrames.some(({ y }) => y !== 0)).toBe(true)
      expect(mirroredFrames.map(({ y }) => y)).toEqual(forwardFrames.map(({ y }) => -y))
      expect(mirroredFrames.map(({ x }) => x)).toEqual(forwardFrames.map(({ x }) => x))
    }
  )
})
