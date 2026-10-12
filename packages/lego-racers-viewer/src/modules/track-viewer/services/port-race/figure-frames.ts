import { getFrontEndFrame } from '@lego-games/lego-racers/front-end'
import type {
  FrontEndEnvironment,
  FrontEndResources,
  FrontEndState,
} from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { OriginalDraw } from '@lego-games/lego-racers/presentation-trace'
import { loadMenuDriverScene } from '@lego-games/lego-racers/racer-appearance'
import {
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { FigurePlace } from './figure-frames.types.ts'

export const MATRIX_SIZE = 16
const FIGURE_SCALE = 1 / 64
const SCALE_LIMIT = 0.1
const DUPLICATE_TOLERANCE = 0.001

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

// The world position of every part frame the original drew (each once): the draw's model matrix is its frame times the
// camera matrix, so the frame's translation is `model x inverse(camera)`.
export const getOriginalFramePositions = (
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
