import {
  createGameSession,
  createSingleRaceSettings,
  createTimeTrialSettings,
  loadGameResources,
  startNextRace,
} from '@lego-games/lego-racers/game-session'
import { createRace } from '@lego-games/lego-racers/race'
import { getCameraView } from '@lego-games/lego-racers/race-camera'
import {
  createRacePresentation,
  getEffectViews,
  getGhostCars,
  getRacerPoses,
} from '@lego-games/lego-racers/race-presentation'
import { Box3, Vector3 } from 'three'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import { createRaceStage } from '../race-viewport/race-viewport.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'

const STAGE_SIZE = { width: 640, height: 480 }
const RACE_NAME = 'rkr'
const GHOST_PART_COUNT = 3
const MAXIMUM_SIZE_RATIO = 2
const MODEL_SCALE = 1 / 64

const getAssets = (isTimeTrial: boolean) => {
  const jam = readOriginalJam()
  const executable = readOriginalExecutable()
  const resources = loadGameResources(jam, executable)
  const request = { raceName: RACE_NAME, localPlayerCount: 1, playerNames: ['ASH'] }
  const settings = isTimeTrial
    ? createTimeTrialSettings(resources, request)
    : createSingleRaceSettings(resources, { ...request, racerCount: 2 })
  const next = startNextRace(createGameSession(resources, settings))
  if (next.kind !== 'race') throw new RangeError('The session has no race')
  return loadRaceAssets(
    jam,
    { executable, tunes: new Map() },
    { raceFolder: next.race.folder },
    next.definition
  )
}

describe('the ghost cars of a time trial', () => {
  it.skipIf(!getIsOriginalGamePresent())(
    'draws the champion from GHOST.WDB at the start of its run',
    () => {
      // Arrange
      const assets = getAssets(true)
      const raceState = createRace(assets.definition)
      const stage = createRaceStage(assets, STAGE_SIZE)
      const { presentation } = createRacePresentation(raceState, 0)
      const { cars } = getGhostCars(raceState)

      // Act
      stage.update(
        getRacerPoses(raceState),
        getCameraView(presentation.camera),
        getEffectViews(raceState),
        null,
        cars
      )

      // Assert
      const champion = cars.find((car) => car.kind === 'champion')
      const ghostGroups = stage.trackScene.children.filter(
        (child) =>
          child.visible &&
          !child.matrixAutoUpdate &&
          child.matrix.elements[12] === champion?.position.x
      )
      expect(assets.ghostScene).not.toBeNull()
      expect(champion).toBeDefined()
      expect(ghostGroups.length).toBeGreaterThanOrEqual(2)
    }
  )

  it.skipIf(!getIsOriginalGamePresent())('loads no ghost car in a race without a ghost', () => {
    // Arrange / Act
    const assets = getAssets(false)

    // Assert
    expect(assets.ghostScene).toBeNull()
    expect(assets.definition.ghost).toBeNull()
  })

  it.skipIf(!getIsOriginalGamePresent())('names the three parts of the champion car', () => {
    // Arrange
    const assets = getAssets(true)

    // Act
    const names = (assets.ghostScene?.instances ?? [])
      .filter((instance) => instance.worldPath.endsWith('GHOST.WDB'))
      .map((instance) => instance.name)

    // Assert
    expect(names).toHaveLength(GHOST_PART_COUNT)
    expect([...names].sort()).toEqual(['ghost2', 'ghostb2', 'ghostdr'])
  })

  it.skipIf(!getIsOriginalGamePresent())(
    'scales the champion parts by their model scale and keeps the car about as large as a racer',
    () => {
      // Arrange
      const assets = getAssets(true)
      const raceState = createRace(assets.definition)
      const stage = createRaceStage(assets, STAGE_SIZE)
      const { presentation } = createRacePresentation(raceState, 0)
      const { cars } = getGhostCars(raceState)

      // Act
      stage.update(
        getRacerPoses(raceState),
        getCameraView(presentation.camera),
        getEffectViews(raceState),
        null,
        cars
      )

      // Assert
      const champion = cars.find((car) => car.kind === 'champion')
      const getExtent = (positionX: number | undefined): number =>
        Math.max(
          ...stage.trackScene.children
            .filter((child) => child.visible && child.matrix.elements[12] === positionX)
            .map((part) => new Box3().setFromObject(part).getSize(new Vector3()).length())
        )
      const ghostExtent = getExtent(champion?.position.x)
      const racerExtent = getExtent(
        raceState.racerSet.racers[0]?.carBody.rigidBody.displayFrame.position.x
      )
      expect(Object.values(assets.ghostScales)).toEqual([MODEL_SCALE, MODEL_SCALE, MODEL_SCALE])
      expect(ghostExtent).toBeLessThan(racerExtent * MAXIMUM_SIZE_RATIO)
    }
  )
})
