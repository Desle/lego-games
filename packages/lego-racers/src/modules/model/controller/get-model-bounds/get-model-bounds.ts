import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { ModelCommandKind } from '../../types/model-command-kind/model-command-kind.ts'
import type { Model, ModelAxisExtent, ModelBounds } from '../../types/model.types.ts'

const NEGATIVE_FLOAT_MAXIMUM = getFloatFromBits(0xff7fffff)
const POSITIVE_FLOAT_MAXIMUM = getFloatFromBits(0x7f7fffff)
const HALF = 0.5
const AXES = [0, 1, 2] as const

// 0x100278c0: the bounding sphere over the vertices the transform_vertices commands name. The centre is the middle
// of the axis-aligned extent, the radius the largest distance to it ((z² + y²) + x², unrounded until the square
// root), and both are multiplied by the model's scale. A model with no such command has no sphere.
export const getModelBounds = (arithmetic: FloatArithmetic, model: Model): ModelBounds | null => {
  const { add, subtract, multiply, getSquareRoot, storeFloat, getIsBelowOrEqual } = arithmetic
  const buffer = model.vertexBuffer ?? model.positionVertexBuffer
  if (buffer === null) return null
  const getPosition = (vertex: number, axis: number): number =>
    buffer.positions[vertex * 3 + axis] ?? 0
  const vertices = model.commands.flatMap((command) =>
    command.kind === ModelCommandKind.TRANSFORM_VERTICES
      ? Array.from({ length: command.vertexCount }, (_, offset) => command.firstVertex + offset)
      : []
  )
  if (vertices.length === 0) return null
  const getExtent = (axis: number): ModelAxisExtent =>
    vertices.reduce(
      (extent, vertex) => {
        const value = getPosition(vertex, axis)
        return {
          minimum: getIsBelowOrEqual(extent.minimum, value) ? extent.minimum : value,
          maximum: getIsBelowOrEqual(value, extent.maximum) ? extent.maximum : value,
        }
      },
      { minimum: POSITIVE_FLOAT_MAXIMUM, maximum: NEGATIVE_FLOAT_MAXIMUM }
    )
  const centre = AXES.map((axis) => {
    const { minimum, maximum } = getExtent(axis)
    return storeFloat(multiply(add(maximum, minimum), HALF))
  })
  const farthest = vertices.reduce((largest, vertex) => {
    const x = subtract(getPosition(vertex, 0), centre[0] ?? 0)
    const y = subtract(getPosition(vertex, 1), centre[1] ?? 0)
    const z = subtract(getPosition(vertex, 2), centre[2] ?? 0)
    const squared = add(add(multiply(z, z), multiply(y, y)), multiply(x, x))
    return getIsBelowOrEqual(squared, largest) ? largest : storeFloat(squared)
  }, NEGATIVE_FLOAT_MAXIMUM)
  return Object.freeze({
    centre: Object.freeze({
      x: storeFloat(multiply(model.scale, centre[0] ?? 0)),
      y: storeFloat(multiply(model.scale, centre[1] ?? 0)),
      z: storeFloat(multiply(model.scale, centre[2] ?? 0)),
    }),
    radius: storeFloat(multiply(getSquareRoot(farthest), model.scale)),
  })
}
