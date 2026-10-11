import { createRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  getFrontEndFrame,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type {
  FrontEndEnvironment,
  FrontEndResources,
  FrontEndState,
} from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import type { OriginalDraw } from '@lego-games/lego-racers/presentation-trace'
import { loadMenuDriverScene } from '@lego-games/lego-racers/racer-appearance'
import {
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const MATRIX_SIZE = 16
const FIGURE_SCALE = 1 / 64
const SCALE_LIMIT = 0.1
const POSITION_TOLERANCE = 0.03
const DUPLICATE_TOLERANCE = 0.001
// The original's main menu opens at this frame of the scenario (the port's first step is the frame after it).
const MENU_OPENED_FRAME = 154
// During `start` (300, 500), the loop of `begin` (900), the blend and `wait` of the 30 second timer (1100, 1250: the
// tap on the glass sounds at frame 208 of `wait`) and after it (1400).
const RECORDED_FRAMES = [300, 500, 900, 1100, 1250, 1400]
const MATCHED_SHARE = 0.7
// The last frame the original still shows the figure, and one after it has left the menu for the demonstration race.
const LAST_FIGURE_FRAME = 1900
const DEMONSTRATION_FRAME = 2100

const multiply = (left: readonly number[], right: readonly number[]): number[] => {
  const product = Array.from({ length: MATRIX_SIZE }, () => 0)
  for (let row = 0; row < 4; row += 1)
    for (let column = 0; column < 4; column += 1)
      for (let inner = 0; inner < 4; inner += 1)
        product[row * 4 + column] =
          (product[row * 4 + column] ?? 0) +
          (left[row * 4 + inner] ?? 0) * (right[inner * 4 + column] ?? 0)
  return product
}

const invert = (matrix: readonly number[]): number[] => {
  const rows = Array.from({ length: 4 }, (_, row) => [
    ...matrix.slice(row * 4, row * 4 + 4),
    ...[0, 1, 2, 3].map((column) => (row === column ? 1 : 0)),
  ])
  for (let column = 0; column < 4; column += 1) {
    let pivot = column
    for (let row = column + 1; row < 4; row += 1)
      if (Math.abs(rows[row]?.[column] ?? 0) > Math.abs(rows[pivot]?.[column] ?? 0)) pivot = row
    const swapped = rows[column] ?? []
    rows[column] = rows[pivot] ?? []
    rows[pivot] = swapped
    const divisor = rows[column]?.[column] ?? 1
    rows[column] = (rows[column] ?? []).map((value) => value / divisor)
    for (let row = 0; row < 4; row += 1) {
      if (row === column) continue
      const factor = rows[row]?.[column] ?? 0
      rows[row] = (rows[row] ?? []).map(
        (value, index) => value - factor * (rows[column]?.[index] ?? 0)
      )
    }
  }
  return rows.flatMap((row) => row.slice(4))
}

const getDistance = (left: readonly number[], right: readonly number[]): number =>
  Math.hypot(
    (left[0] ?? 0) - (right[0] ?? 0),
    (left[1] ?? 0) - (right[1] ?? 0),
    (left[2] ?? 0) - (right[2] ?? 0)
  )

// The world position of every part frame the original drew (each once): the draw's model matrix is its frame times the
// camera matrix, so the frame's translation is `model x inverse(camera)`.
const getOriginalFramePositions = (
  draws: readonly OriginalDraw[]
): readonly (readonly number[])[] =>
  draws
    .flatMap((draw) => {
      if (draw.modelMatrix.length !== MATRIX_SIZE || draw.clipMatrix.length !== MATRIX_SIZE)
        return []
      if (Math.hypot(draw.modelMatrix[0] ?? 0, draw.modelMatrix[1] ?? 0) > SCALE_LIMIT) return []
      return [multiply(draw.modelMatrix, invert(draw.clipMatrix)).slice(12, 15)]
    })
    .filter(
      (position, index, all) =>
        all.findIndex((other) => getDistance(other, position) < DUPLICATE_TOLERANCE) === index
    )

type FigurePlace = {
  readonly partBytes: readonly number[]
  readonly position: readonly number[]
  readonly forward: readonly number[]
  readonly animation: SkeletonAnimationState
}

// The world positions of the port's bones for the figure the main menu draws.
const getPortBonePositions = (
  archive: JamArchive,
  figure: FigurePlace
): readonly (readonly number[])[] => {
  const { scene } = loadMenuDriverScene(archive, figure.partBytes)
  const skeleton = scene.skeletons[0]?.skeleton
  const animation = scene.animations[0]?.animation
  if (skeleton === undefined || animation === undefined) return []
  const matrices = getBoneMatrices(
    skeleton,
    getSkeletonPose(getRestPose(skeleton), animation, figure.animation)
  )
  const angle = Math.atan2(figure.forward[1] ?? 0, figure.forward[0] ?? 1)
  return Array.from({ length: matrices.length / MATRIX_SIZE }, (_, bone) => {
    const x = (matrices[bone * MATRIX_SIZE + 12] ?? 0) * FIGURE_SCALE
    const y = (matrices[bone * MATRIX_SIZE + 13] ?? 0) * FIGURE_SCALE
    const z = (matrices[bone * MATRIX_SIZE + 14] ?? 0) * FIGURE_SCALE
    return [
      (figure.position[0] ?? 0) + x * Math.cos(angle) - y * Math.sin(angle),
      (figure.position[1] ?? 0) + x * Math.sin(angle) + y * Math.cos(angle),
      (figure.position[2] ?? 0) + z,
    ]
  })
}

const getFigure = (
  state: FrontEndState,
  resources: FrontEndResources,
  environment: FrontEndEnvironment
): FigurePlace | null => {
  for (const command of getFrontEndFrame(state, resources, environment).commands) {
    if (command.kind !== 'viewport' || command.driver === null) continue
    const { partBytes, position, forward, animation } = command.driver
    if (animation !== null) return { partBytes, position, forward, animation }
  }
  return null
}

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end figure animation',
  () => {
    // eslint-disable-next-line no-restricted-syntax -- the describe body is one test, not an expression to return
    it('matches the original over time', async () => {
      // Arrange
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
      const frames = Array.from({ length: DEMONSTRATION_FRAME + 1 }, () => ({
        milliseconds: FRAME_MILLISECONDS,
        scanCodes: [] as number[],
      }))

      // Act
      const original = await readOriginalFrontEnd({
        name: 'figure animation',
        frames,
        recordFrames: [...RECORDED_FRAMES, LAST_FIGURE_FRAME, DEMONSTRATION_FRAME],
        isRenderRecorded: true,
      })
      let state: FrontEndState = createFrontEnd(resources, environment)
      let steps = 0
      const shares = RECORDED_FRAMES.map((recordedFrame) => {
        while (steps < recordedFrame - MENU_OPENED_FRAME) {
          state = stepFrontEnd(state, resources, environment, null, FRAME_MILLISECONDS).state
          steps += 1
        }
        const figure = getFigure(state, resources, environment)
        const draws =
          original.renderFrames.find((candidate) => candidate.frame === recordedFrame)?.draws ?? []
        const originalPositions = getOriginalFramePositions(draws)
        const bonePositions = figure === null ? [] : getPortBonePositions(archive, figure)
        const matched = originalPositions.filter((position) =>
          bonePositions.some((bone) => getDistance(bone, position) < POSITION_TOLERANCE)
        )
        return matched.length / originalPositions.length
      })
      const figureFrameCounts = [LAST_FIGURE_FRAME, DEMONSTRATION_FRAME].map(
        (recordedFrame) =>
          getOriginalFramePositions(
            original.renderFrames.find((candidate) => candidate.frame === recordedFrame)?.draws ??
              []
          ).length
      )

      // Assert
      expect(Math.min(...shares)).toBeGreaterThan(MATCHED_SHARE)
      expect(figureFrameCounts[0]).toBeGreaterThan(0)
      expect(figureFrameCounts[1]).toBe(0)
    })
  }
)
