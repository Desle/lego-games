import { createRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  getFrontEndDemonstrationRequest,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type { FrontEndEnvironment, FrontEndState } from '@lego-games/lego-racers/front-end'
import {
  createDemonstrationSettings,
  loadGameResources,
} from '@lego-games/lego-racers/game-session'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  matchTextures,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'
import { getSceneTextures } from './render-comparison.ts'

const FRAME_MILLISECONDS = 33
// The original's main menu opens at this frame of the scenario (see front-end-figure-animation.trace.spec.ts).
const MENU_OPENED_FRAME = 154
// The last frame the original shows the menu and the first it shows the race (measured at 5-frame steps).
const LAST_MENU_FRAME = 1970
const FIRST_RACE_FRAME = 1975
const RACE_FRAME = 2100
// A picture of the original this close to a texture of the race has that texture (0..255 per channel).
const TEXTURE_DIFFERENCE_LIMIT = 6
const DEMONSTRATION_RACE_FOLDERS = ['RACEC0R0', 'RACEC0R1', 'RACEC0R2', 'RACEC0R3']

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end demonstration',
  () => {
    // eslint-disable-next-line no-restricted-syntax -- the describe body is one test, not an expression to return
    it('starts the same race as the original at the same time', async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const resources = loadFrontEndResources(openJamArchive(jam))
      const environment: FrontEndEnvironment = {
        controllerCount: 1,
        unlockedCircuitMask: 0x7f,
        randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
        isEveryPartUnlocked: true,
        playerRacerNames: [],
        standingRows: [],
      }
      const frames = Array.from({ length: RACE_FRAME + 1 }, () => ({
        milliseconds: FRAME_MILLISECONDS,
        scanCodes: [] as number[],
      }))

      // Act
      const original = await readOriginalFrontEnd({
        name: 'demonstration',
        frames,
        recordFrames: [LAST_MENU_FRAME, FIRST_RACE_FRAME, RACE_FRAME],
        isRenderRecorded: true,
      })
      let state: FrontEndState = createFrontEnd(resources, environment)
      let steps = 0
      while (state.outcome === 'running' && steps < RACE_FRAME) {
        state = stepFrontEnd(state, resources, environment, null, FRAME_MILLISECONDS).state
        steps += 1
      }
      const request = getFrontEndDemonstrationRequest(state)
      const gameResources = loadGameResources(jam, executable)
      const settings = request === null ? null : createDemonstrationSettings(gameResources, request)
      const raceFrame = original.renderFrames.find((candidate) => candidate.frame === RACE_FRAME)
      const usedHashes = new Set(
        (raceFrame?.draws ?? []).flatMap((draw) =>
          draw.textureHash === null ? [] : [draw.textureHash]
        )
      )
      const originalTextures = new Map(
        [...original.textures].filter(([hash]) => usedHashes.has(hash))
      )
      const scores = DEMONSTRATION_RACE_FOLDERS.map((raceFolder) => {
        const assets = loadRaceAssets(
          jam,
          { executable, tunes: new Map() },
          { raceFolder, racerCount: 6, localPlayerCount: 0, fpuPrecision: FpuPrecision.SINGLE }
        )
        const matches = matchTextures(originalTextures, getSceneTextures(assets))
        return [...matches.values()].filter(
          (match) => match.bestKey !== null && match.difference <= TEXTURE_DIFFERENCE_LIMIT
        ).length
      })

      // Assert
      expect(MENU_OPENED_FRAME + steps).toBeGreaterThan(LAST_MENU_FRAME)
      expect(MENU_OPENED_FRAME + steps).toBeLessThanOrEqual(FIRST_RACE_FRAME)
      expect(settings?.localPlayerCount).toBe(0)
      expect(settings?.racerCount).toBe(6)
      const pickedFolder =
        gameResources.catalog.entries
          .find((entry) => entry.name === settings?.raceNames[0])
          ?.firstName.toUpperCase() ?? ''
      expect(pickedFolder).not.toBe('')
      expect(scores[DEMONSTRATION_RACE_FOLDERS.indexOf(pickedFolder)]).toBe(Math.max(...scores))
      expect(scores.filter((score) => score === Math.max(...scores))).toHaveLength(1)
    })
  }
)
