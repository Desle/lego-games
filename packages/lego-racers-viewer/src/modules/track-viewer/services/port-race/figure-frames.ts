import {
  getActiveCinemaActions,
  getCinemaLoopMilliseconds,
  parseCinemaDatabase,
} from '@lego-games/lego-racers/cinema'
import { getFrontEndFrame } from '@lego-games/lego-racers/front-end'
import type { RaceCinemaView } from '@lego-games/lego-racers/front-end'
import type {
  FrontEndEnvironment,
  FrontEndResources,
  FrontEndState,
} from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { OriginalDraw } from '@lego-games/lego-racers/presentation-trace'
import { loadMenuDriverScene } from '@lego-games/lego-racers/racer-appearance'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { FigurePlace } from './figure-frames.types.ts'

export const MATRIX_SIZE = 16
const FIGURE_SCALE = 1 / 64
const SCALE_LIMIT = 0.1
const DUPLICATE_TOLERANCE = 0.001

const getBoneTranslation = (
  matrices: Float32Array,
  bone: number
): readonly [number, number, number] => {
  const at = (offset: number): number => (matrices[bone * MATRIX_SIZE + offset] ?? 0) * FIGURE_SCALE
  return [at(12), at(13), at(14)]
}

export const multiply = (left: readonly number[], right: readonly number[]): number[] => {
  const product = Array.from({ length: MATRIX_SIZE }, () => 0)
  for (let row = 0; row < 4; row += 1)
    for (let column = 0; column < 4; column += 1)
      for (let inner = 0; inner < 4; inner += 1)
        product[row * 4 + column] =
          (product[row * 4 + column] ?? 0) +
          (left[row * 4 + inner] ?? 0) * (right[inner * 4 + column] ?? 0)
  return product
}

export const invert = (matrix: readonly number[]): number[] => {
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

export const getDistance = (left: readonly number[], right: readonly number[]): number =>
  Math.hypot(
    (left[0] ?? 0) - (right[0] ?? 0),
    (left[1] ?? 0) - (right[1] ?? 0),
    (left[2] ?? 0) - (right[2] ?? 0)
  )

// The draws of a menu figure: its part frames carry the figure's 1/64 scale, which no other draw of a menu has.
export const getOriginalFigureDraws = (draws: readonly OriginalDraw[]): readonly OriginalDraw[] =>
  draws.filter(
    (draw) =>
      draw.modelMatrix.length === MATRIX_SIZE &&
      draw.clipMatrix.length === MATRIX_SIZE &&
      Math.hypot(draw.modelMatrix[0] ?? 0, draw.modelMatrix[1] ?? 0) <= SCALE_LIMIT
  )

// The world position of every part frame the original drew (each once): the draw's model matrix is its frame times the
// camera matrix, so the frame's translation is `model x inverse(camera)`.
export const getOriginalFramePositions = (
  draws: readonly OriginalDraw[]
): readonly (readonly number[])[] =>
  getOriginalFigureDraws(draws)
    .map((draw) => multiply(draw.modelMatrix, invert(draw.clipMatrix)).slice(12, 15))
    .filter(
      (position, index, all) =>
        all.findIndex((other) => getDistance(other, position) < DUPLICATE_TOLERANCE) === index
    )

// The world positions of the port's bones for the figure a menu draws.
export const getPortBonePositions = (
  archive: JamArchive,
  figure: FigurePlace
): readonly (readonly number[])[] => {
  const { scene } = loadMenuDriverScene(archive, figure.partBytes, figure.animationName)
  const skeleton = scene.skeletons[0]?.skeleton
  const animation = scene.animations[0]?.animation
  if (skeleton === undefined || animation === undefined) return []
  const matrices = getBoneMatrices(
    skeleton,
    getSkeletonPose(getRestPose(skeleton), animation, figure.animation)
  )
  const angle = Math.atan2(figure.forward[1] ?? 0, figure.forward[0] ?? 1)
  return Array.from({ length: matrices.length / MATRIX_SIZE }, (_, bone) => {
    const [x, y, z] = getBoneTranslation(matrices, bone)
    return [
      (figure.position[0] ?? 0) + x * Math.cos(angle) - y * Math.sin(angle),
      (figure.position[1] ?? 0) + x * Math.sin(angle) + y * Math.cos(angle),
      (figure.position[2] ?? 0) + z,
    ]
  })
}

// The world positions of the bones of the champion's figure in a race preview: the guy1 action of the cinema places the figure
// (its frame: forward, up x forward, up, scaled by the figure's 1/64) and its flag is the clip of GUY1.ADB.
export const getCinemaBonePositions = (
  archive: JamArchive,
  view: RaceCinemaView
): readonly (readonly number[])[] => {
  const cinema = parseCinemaDatabase(archive.readFile('MENUDATA\\SINGRACE\\PST.CDB')).cinemas.find(
    (candidate) => candidate.name.toLowerCase() === view.cinemaName.toLowerCase()
  )
  const action =
    cinema === undefined
      ? undefined
      : getActiveCinemaActions(cinema, view.milliseconds).find(
          (candidate) => candidate.instanceName === 'guy1'
        )
  if (cinema === undefined || action === undefined || view.partBytes === null) return []
  const { scene } = loadMenuDriverScene(archive, view.partBytes, 'SINGRACE\\GUY1')
  const skeleton = scene.skeletons[0]?.skeleton
  const animation = scene.animations[0]?.animation
  if (skeleton === undefined || animation === undefined) return []
  const state = advanceSkeletonAnimation(
    createSkeletonAnimationState(animation, action.flag),
    animation,
    getCinemaLoopMilliseconds(cinema, view.milliseconds)
  )
  const matrices = getBoneMatrices(
    skeleton,
    getSkeletonPose(getRestPose(skeleton), animation, state)
  )
  const [forwardX, forwardY, forwardZ] = action.forward
  const [upX, upY, upZ] = action.up
  const [sideX, sideY, sideZ] = [
    upY * forwardZ - upZ * forwardY,
    upZ * forwardX - upX * forwardZ,
    upX * forwardY - upY * forwardX,
  ] as const
  return Array.from({ length: matrices.length / MATRIX_SIZE }, (_, bone) => {
    const [x, y, z] = getBoneTranslation(matrices, bone)
    return [
      action.position[0] + x * forwardX + y * sideX + z * upX,
      action.position[1] + x * forwardY + y * sideY + z * upY,
      action.position[2] + x * forwardZ + y * sideZ + z * upZ,
    ]
  })
}

export const getFigure = (
  state: FrontEndState,
  resources: FrontEndResources,
  environment: FrontEndEnvironment
): FigurePlace | null => {
  for (const command of getFrontEndFrame(state, resources, environment).commands) {
    const driver = command.kind === 'viewport' ? (command.driver ?? command.showcase?.driver) : null
    if (driver === null || driver === undefined) continue
    const { partBytes, position, forward, animationName, animation } = driver
    if (animation !== null) return { partBytes, position, forward, animationName, animation }
  }
  return null
}
