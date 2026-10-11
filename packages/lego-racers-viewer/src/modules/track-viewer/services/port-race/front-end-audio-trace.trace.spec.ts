import { createRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type { FrontEndEnvironment, FrontEndInput } from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import type { FrontEndScenario } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'
import type { FrontEndAudioCase } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

const SCAN_CODE_INPUTS: Readonly<Record<number, FrontEndInput>> = {
  200: 'up',
  208: 'down',
  203: 'left',
  205: 'right',
  28: 'accept',
  1: 'back',
}
const DOWN = 208
const ENTER = 28
// The original shows its logos until frame 152 and the main menu from then on; the keys come after.
const FIRST_KEY_FRAME = 250
const KEY_SPACING_FRAMES = 20
const FRAME_MILLISECONDS = 33
const TRAILING_FRAMES = 80

const FRONT_END_CASES: readonly FrontEndAudioCase[] = [
  { name: 'main menu', scanCodes: [] },
  { name: 'main menu, garage', scanCodes: [ENTER] },
  { name: 'main menu, circuit race', scanCodes: [DOWN, ENTER] },
  { name: 'main menu, single race', scanCodes: [DOWN, DOWN, ENTER] },
  { name: 'main menu, time trial', scanCodes: [DOWN, DOWN, DOWN, ENTER] },
  { name: 'main menu, options', scanCodes: [DOWN, DOWN, DOWN, DOWN, ENTER] },
]

const getScenario = (frontEndCase: FrontEndAudioCase): FrontEndScenario => {
  const length =
    FIRST_KEY_FRAME + KEY_SPACING_FRAMES * frontEndCase.scanCodes.length + TRAILING_FRAMES
  return {
    name: frontEndCase.name,
    recordFrames: [],
    isRenderRecorded: false,
    frames: Array.from({ length }, (_, frame) => {
      const keyIndex = (frame - FIRST_KEY_FRAME) / KEY_SPACING_FRAMES
      const scanCode = Number.isInteger(keyIndex) ? frontEndCase.scanCodes[keyIndex] : undefined
      return {
        milliseconds: FRAME_MILLISECONDS,
        scanCodes: scanCode === undefined ? [] : [scanCode],
      }
    }),
  }
}

describe.skipIf(!isGamePresent())('front end audio trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `it(...)`, not `it.each(...)(...)`
  it.each(FRONT_END_CASES)('compares the music of $name', async (frontEndCase) => {
    // Arrange
    const scenario = getScenario(frontEndCase)
    const archive = openJamArchive(readOriginalJam())
    const resources = loadFrontEndResources(archive)
    const environment: FrontEndEnvironment = {
      controllerCount: 1,
      unlockedCircuitMask: 0x7f,
      randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
      isEveryPartUnlocked: true,
      playerRacerNames: [],
      standingRows: [],
    }

    // Act
    const original = await readOriginalFrontEnd(scenario)
    let state = createFrontEnd(resources, environment)
    const portMusic: number[] = state.musicListIndex === null ? [] : [state.musicListIndex]
    for (const frame of scenario.frames.slice(FIRST_KEY_FRAME)) {
      const scanCode = frame.scanCodes[0]
      const step = stepFrontEnd(
        state,
        resources,
        environment,
        scanCode === undefined ? null : (SCAN_CODE_INPUTS[scanCode] ?? null),
        frame.milliseconds
      )
      state = step.state
      if (step.musicListIndex !== null) portMusic.push(step.musicListIndex)
    }
    const originalMusic = original.audioFrames.flatMap((audioFrame) =>
      audioFrame.events.flatMap((event) =>
        event.kind === 'musicOpen' ? [event.values['index'] as number] : []
      )
    )

    // Assert
    expect(portMusic).toEqual(originalMusic)
  })
})
