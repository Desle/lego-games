import { loadRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  getFrontEndFrame,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type {
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndState,
  FrontEndViewportCommand,
} from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import { loadScene } from '@lego-games/lego-racers/scene'
import { getEmitterScreenPoints } from './cinema-emitter-points.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const MENU_OPENED_FRAME = 154
const POINT_TOLERANCE = 0.3
const SNOW_TEXTURE_PREFIX = '38c202'
// Down and enter open the circuit race screen, right the second circuit, whose third race is the ice world (snow).
const KEYS: readonly (readonly [number, FrontEndInput, number])[] = [
  [250, 'down', 208],
  [270, 'accept', 28],
  [290, 'right', 205],
]
const WATCHED_FRAMES = [420, 440, 441, 442, 460, 470]
const MATCHED_SHARE = 0.85
const CLIPPED_SHARE = 0.6

const archive = openJamArchive(readOriginalJam())
const resources = loadFrontEndResources(archive)
const environment: FrontEndEnvironment = {
  controllerCount: 1,
  unlockedCircuitMask: 0x7f,
  randomTable: loadRandomTable(readOriginalExecutable()),
  isEveryPartUnlocked: true,
  playerRacerNames: [],
  standingRows: [],
}

const getViewport = (state: FrontEndState): FrontEndViewportCommand | null => {
  for (const command of getFrontEndFrame(state, resources, environment).commands) {
    if (command.kind === 'viewport' && command.cinema !== null) return command
  }
  return null
}

const getShare = (
  points: readonly (readonly number[])[],
  others: readonly (readonly number[])[]
): number =>
  points.filter((point) =>
    others.some(
      (other) =>
        Math.hypot((other[0] ?? 0) - (point[0] ?? 0), (other[1] ?? 0) - (point[1] ?? 0)) <
        POINT_TOLERANCE
    )
  ).length / Math.max(1, points.length)

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end race cinema snow',
  () => {
    // eslint-disable-next-line no-restricted-syntax -- the test body is a block of steps
    it('draws the snow of the ice world like the original as the races change', async () => {
      // Arrange
      const scene = loadScene(archive, [
        'MENUDATA\\SINGRACE\\PST.WDB',
        'MENUDATA\\SINGRACE\\BLENDED.WDB',
        'MENUDATA\\SINGRACE\\EMITTER.WDB',
      ])
      const camera = scene.cameras[0]
      if (camera === undefined) throw new RangeError('The preview world has a camera')
      const lastFrame = Math.max(...WATCHED_FRAMES)
      const original = await readOriginalFrontEnd({
        name: 'race cinema snow',
        frames: Array.from({ length: lastFrame + 1 }, (_, frame) => {
          const key = KEYS.find(([keyFrame]) => keyFrame === frame)
          return { milliseconds: FRAME_MILLISECONDS, scanCodes: key === undefined ? [] : [key[2]] }
        }),
        recordFrames: WATCHED_FRAMES,
        isRenderRecorded: true,
      })
      let state: FrontEndState = createFrontEnd(resources, environment)
      let steps = 0

      // Act
      const frames = WATCHED_FRAMES.map((watchedFrame) => {
        while (steps < watchedFrame - MENU_OPENED_FRAME) {
          steps += 1
          const input =
            KEYS.find(([keyFrame]) => keyFrame === MENU_OPENED_FRAME + steps - 1)?.[1] ?? null
          state = stepFrontEnd(state, resources, environment, input, FRAME_MILLISECONDS).state
        }
        const viewport = getViewport(state)
        const pool = viewport?.cinema?.emitterPool ?? null
        const { rectangle } = viewport ?? { rectangle: { left: 0, top: 0, right: 1, bottom: 1 } }
        const portPoints =
          pool === null
            ? []
            : getEmitterScreenPoints(pool, camera, {
                left: rectangle.left,
                top: rectangle.top,
                width: rectangle.right - rectangle.left,
                height: rectangle.bottom - rectangle.top,
              })
        const draws =
          original.renderFrames.find((candidate) => candidate.frame === watchedFrame)?.draws ?? []
        const originalPoints = draws
          .filter((draw) => draw.textureHash?.startsWith(SNOW_TEXTURE_PREFIX) === true)
          .flatMap((draw) =>
            [...new Set(draw.indices ?? [])].map((index) => [
              draw.vertices[index]?.x ?? 0,
              draw.vertices[index]?.y ?? 0,
            ])
          )
        return {
          frame: watchedFrame,
          portCount: portPoints.length,
          originalCount: originalPoints.length,
          portShare: getShare(portPoints, originalPoints),
          originalShare: getShare(originalPoints, portPoints),
        }
      })

      // Assert
      // The few quads the original clips at the edge of the viewport (it draws polygons of other vertices there) stay
      // unmatched; with 3 quads on show at frame 420 that is one of three.
      const getMean = (shares: readonly number[]): number =>
        shares.reduce((sum, share) => sum + share, 0) / shares.length
      expect(getMean(frames.map((frame) => frame.originalShare))).toBeGreaterThan(MATCHED_SHARE)
      expect(getMean(frames.map((frame) => frame.portShare))).toBeGreaterThan(MATCHED_SHARE)
      expect(Math.min(...frames.map((frame) => frame.originalShare))).toBeGreaterThan(CLIPPED_SHARE)
      expect(Math.min(...frames.map((frame) => frame.portShare))).toBeGreaterThan(CLIPPED_SHARE)
      expect(frames.every((frame) => Math.abs(frame.portCount - frame.originalCount) <= 20)).toBe(
        true
      )
    })
  }
)
