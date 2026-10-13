import { openJamArchive } from '../../../jam-archive/index.ts'
import {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
} from '../../../presentation-trace/index.ts'
import type { OriginalScreenEvent } from '../../../presentation-trace/index.ts'
import { loadRandomTable } from '../../../random-table/index.ts'
import {
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { loadFrontEndResources } from '../../services/load-front-end-resources/load-front-end-resources.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndState,
} from '../../types/front-end.types.ts'
import { createFrontEnd, stepFrontEnd } from './front-end.ts'

const FRAME_MILLISECONDS = 33
// The original opens its main menu in frame 154; the port's front end is created for that frame.
const MENU_OPENED_FRAME = 154
const DOWN = 208
const UP = 200
const ENTER = 28
const SCAN_CODE_INPUTS: ReadonlyMap<number, FrontEndInput> = new Map([
  [DOWN, 'down'],
  [UP, 'up'],
  [ENTER, 'accept'],
])
// Down and enter open the circuit race screen, enter the racer pick, enter picks the racer (his reaction clip plays).
const CIRCUIT_KEYS: readonly (readonly [number, number])[] = [
  [250, DOWN],
  [270, ENTER],
  [290, ENTER],
  [310, ENTER],
]

type CircuitStartCase = {
  readonly name: string
  readonly keys: readonly (readonly [number, number])[]
  readonly lastFrame: number
  // The frame the original takes the introduction off (it ended, or a key ended it), null when it plays on.
  readonly endFrame: number | null
  // The port gets a key one frame after the original (the pixel trace's convention), so a key's end shows one frame later.
  readonly isEndedByKey: boolean
}

const CASES: readonly CircuitStartCase[] = [
  {
    name: 'the introduction plays to its end',
    keys: [],
    lastFrame: 910,
    endFrame: 905,
    isEndedByKey: false,
  },
  {
    name: 'enter ends it from one second in',
    keys: [[440, ENTER]],
    lastFrame: 450,
    endFrame: 440,
    isEndedByKey: true,
  },
  {
    name: 'enter before one second and the focus keys do not',
    keys: [
      [439, ENTER],
      [450, DOWN],
      [460, UP],
    ],
    lastFrame: 470,
    endFrame: null,
    isEndedByKey: false,
  },
]

const archive = openJamArchive(readOriginalJam())
const resources = loadFrontEndResources(archive)
const environment: FrontEndEnvironment = {
  // The emulated original has no gamepad.
  controllerCount: 0,
  unlockedCircuitMask: 0x7f,
  randomTable: loadRandomTable(readOriginalExecutable()),
  isEveryPartUnlocked: true,
  playerRacerNames: [],
  standingRows: [],
}

type PortFrame = {
  readonly frame: number
  readonly screenIds: readonly number[]
  readonly outcome: FrontEndState['outcome']
}

// One port step per original frame from the main menu on; a key tapped in original frame f reaches the step of f + 1.
const runPort = (circuitCase: CircuitStartCase): readonly PortFrame[] => {
  const keys = [...CIRCUIT_KEYS, ...circuitCase.keys]
  const frames: PortFrame[] = []
  let state = createFrontEnd(resources, environment)
  for (let frame = MENU_OPENED_FRAME + 1; frame <= circuitCase.lastFrame; frame += 1) {
    const scanCode = keys.find(([keyFrame]) => keyFrame === frame - 1)?.[1]
    const input = scanCode === undefined ? null : (SCAN_CODE_INPUTS.get(scanCode) ?? null)
    state = stepFrontEnd(state, resources, environment, input, FRAME_MILLISECONDS).state
    frames.push({
      frame,
      screenIds: state.screens.map((screen) => screen.screenId),
      outcome: state.outcome,
    })
    if (state.outcome !== 'running') break
  }
  return frames
}

const getFirstFrame = (
  frames: readonly PortFrame[],
  isMatch: (frame: PortFrame) => boolean
): number | null => frames.find(isMatch)?.frame ?? null

const getOriginalFrames = (events: readonly OriginalScreenEvent[]) => {
  const introductionPush = events.find(
    (event) => event.kind === 'push' && event.screenId === FrontEndScreen.CIRCUIT_ONE_INTRODUCTION
  )
  const savePush = events.find(
    (event) => event.kind === 'push' && event.screenId === FrontEndScreen.SAVE_ALL
  )
  const pops = events.filter(
    (event) => event.kind === 'pop' && savePush !== undefined && event.frame >= savePush.frame
  )
  return {
    introduction: introductionPush?.frame ?? null,
    save: savePush?.frame ?? null,
    saveLeft: pops[0]?.frame ?? null,
    end: pops[1]?.frame ?? null,
  }
}

describe.skipIf(!getIsOriginalPresentationAvailable())(
  'the start of a circuit against the original front end',
  () =>
    it.each(CASES)(
      '$name',
      async (circuitCase) => {
        // Arrange
        const keys = [...CIRCUIT_KEYS, ...circuitCase.keys]
        const original = await readOriginalFrontEnd({
          name: circuitCase.name,
          frames: Array.from({ length: circuitCase.lastFrame + 1 }, (_, frame) => ({
            milliseconds: FRAME_MILLISECONDS,
            scanCodes: keys.filter(([keyFrame]) => keyFrame === frame).map(([, code]) => code),
          })),
          recordFrames: [],
          isRenderRecorded: false,
        })

        // Act
        const port = runPort(circuitCase)
        const originalFrames = getOriginalFrames(original.screenEvents)
        const portFrames = {
          introduction: getFirstFrame(port, (frame) =>
            frame.screenIds.includes(FrontEndScreen.CIRCUIT_ONE_INTRODUCTION)
          ),
          save: getFirstFrame(port, (frame) => frame.screenIds.at(-1) === FrontEndScreen.SAVE_ALL),
          saveLeft: getFirstFrame(
            port,
            (frame) => frame.screenIds.at(-1) === FrontEndScreen.CIRCUIT_ONE_INTRODUCTION
          ),
          end: getFirstFrame(port, (frame) => frame.outcome === 'race'),
        }

        // Assert
        expect(originalFrames.end).toBe(circuitCase.endFrame)
        expect(portFrames).toEqual({
          ...originalFrames,
          end:
            originalFrames.end === null
              ? null
              : originalFrames.end + (circuitCase.isEndedByKey ? 1 : 0),
        })
      },
      600_000
    )
)
