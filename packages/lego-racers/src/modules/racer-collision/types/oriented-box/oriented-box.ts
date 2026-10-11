import { FLOAT32_MAXIMUM, getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import type {
  AxisResult,
  AxisTest,
  BoxContact,
  BoxOverlap,
  OrientedBox,
  Triple,
} from '../racer-collision.types.ts'

const HALF = getFloatFromBits(0x3f000000) // 0x004af58c
const PARALLEL_LIMIT = getFloatFromBits(0x3a83126f) // 0x004af220, 0.001
const NEGATIVE_PARALLEL_LIMIT = getFloatFromBits(0xba83126f) // 0x004af594

const ZERO_NORMAL: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 })

const getRow = (rotation: Matrix3, row: number): Vector3 =>
  Object.freeze({
    x: rotation[row * 3] ?? 0,
    y: rotation[row * 3 + 1] ?? 0,
    z: rotation[row * 3 + 2] ?? 0,
  })

// The three half extents of 0x00441790 (each `dimension · 0.5`, stored; then times the scale when it is not 1.0).
// A scale of exactly 0 ends the test.
const getHalfExtents = (arithmetic: FloatArithmetic, box: OrientedBox): Triple | undefined => {
  const { multiply, storeFloat, getIsEqual } = arithmetic
  const halves = [box.dimensions.x, box.dimensions.y, box.dimensions.z].map((dimension) =>
    storeFloat(multiply(dimension, HALF))
  ) as unknown as Triple
  if (box.scale === 1) return halves
  if (getIsEqual(box.scale, 0)) return undefined
  return halves.map((half) => storeFloat(multiply(box.scale, half))) as unknown as Triple
}

// 0x00449b90 (cdecl: vector, matrix, target): each component is `(m[2] · z + m[1] · y) + x · m[0]`, stored.
const getVectorInFrame = (
  arithmetic: FloatArithmetic,
  rotation: Matrix3,
  vector: Vector3
): Triple => {
  const { add, multiply, storeFloat } = arithmetic
  const getComponent = (row: number): number =>
    storeFloat(
      add(
        add(
          multiply(rotation[row * 3 + 2] ?? 0, vector.z),
          multiply(rotation[row * 3 + 1] ?? 0, vector.y)
        ),
        multiply(vector.x, rotation[row * 3] ?? 0)
      )
    )
  return [getComponent(0), getComponent(1), getComponent(2)]
}

// How 0x00449bf0 groups the three products of element (second row, first row): which pair is added first.
const PRODUCT_ORDERS: readonly (readonly [number, number, number])[] = [
  [1, 2, 0],
  [1, 2, 0],
  [1, 2, 0],
  [1, 2, 0],
  [2, 0, 1],
  [0, 2, 1],
  [1, 2, 0],
  [0, 2, 1],
  [1, 2, 0],
]

// 0x00449bf0 (cdecl: second box's matrix, first box's matrix, target): element 3i + j is the dot
// product of row i of the second matrix and row j of the first, each stored.
const getRelativeRotation = (
  arithmetic: FloatArithmetic,
  first: Matrix3,
  second: Matrix3
): readonly number[] => {
  const { add, multiply, storeFloat } = arithmetic
  return PRODUCT_ORDERS.map(([leading, middle, last], element) => {
    const row = Math.floor(element / 3)
    const column = element % 3
    const getProduct = (term: number): number =>
      multiply(second[row * 3 + term] ?? 0, first[column * 3 + term] ?? 0)
    return storeFloat(add(add(getProduct(leading), getProduct(middle)), getProduct(last)))
  })
}

const getAxisResult = (
  arithmetic: FloatArithmetic,
  result: AxisResult,
  axis: number,
  test: AxisTest
): AxisResult | undefined => {
  const { add, subtract, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const total = add(test.reach, test.half)
  if (!getIsBelowOrEqual(test.distance, total)) return undefined
  const overlap = storeFloat(subtract(total, test.distance))
  if (!getIsBelow(overlap, result.minimum)) return result
  return {
    minimum: overlap,
    axis,
    firstReach: storeFloat(subtract(test.half, overlap)),
    secondReach: storeFloat(subtract(storeFloat(test.reach), overlap)),
  }
}

// 0x00441790 (thiscall on the first box: second box, overlap, normal, two reaches): the 15-axis
// separating-axis test of two oriented boxes. Only the six face axes set the result; the nine
// edge-pair axes can only separate (when their extent is at least 0.001). Cases 6..14 of the
// normal switch (0x004422e1) are unreachable because the chosen axis is at most 5.
export const getBoxOverlap = (
  arithmetic: FloatArithmetic,
  first: OrientedBox,
  second: OrientedBox
): BoxOverlap | undefined => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const firstHalves = getHalfExtents(arithmetic, first)
  const secondHalves = getHalfExtents(arithmetic, second)
  if (firstHalves === undefined || secondHalves === undefined) return undefined
  const [a0, a1, a2] = firstHalves
  const [b0, b1, b2] = secondHalves
  const offset = Object.freeze({
    x: storeFloat(subtract(second.centre.x, first.centre.x)),
    y: storeFloat(subtract(second.centre.y, first.centre.y)),
    z: storeFloat(subtract(second.centre.z, first.centre.z)),
  })
  const [t0, t1, t2] = getVectorInFrame(arithmetic, first.rotation, offset)
  const relative = getRelativeRotation(arithmetic, first.rotation, second.rotation)
  const getR = (index: number): number => relative[index] ?? 0
  const getQ = (index: number): number => Math.abs(getR(index))
  const getTerms = (pairs: readonly (readonly [number, number])[]): number[] =>
    pairs.map(([q, half]) => multiply(getQ(q), half))
  const getSum3 = (pairs: readonly (readonly [number, number])[]): number => {
    const [x, y, z] = getTerms(pairs) as [number, number, number]
    return add(add(x, y), z)
  }
  const getProjection = (
    first3: number,
    second3: number,
    third3: number,
    indices: readonly number[]
  ) => {
    const [i0, i1, i2] = indices as [number, number, number]
    return Math.abs(
      add(add(multiply(third3, getR(i2)), multiply(second3, getR(i1))), multiply(first3, getR(i0)))
    )
  }
  // The six face axes, in the order the original tests them (0x00441a3d..0x00441dbf).
  const tests: readonly AxisTest[] = [
    {
      distance: Math.abs(t0),
      reach: getSum3([
        [6, b2],
        [3, b1],
        [0, b0],
      ]),
      half: a0,
    },
    {
      distance: getProjection(t0, t1, t2, [0, 1, 2]),
      reach: getSum3([
        [2, a2],
        [1, a1],
        [0, a0],
      ]),
      half: b0,
    },
    {
      distance: Math.abs(t1),
      reach: getSum3([
        [7, b2],
        [4, b1],
        [1, b0],
      ]),
      half: a1,
    },
    {
      distance: Math.abs(t2),
      reach: getSum3([
        [8, b2],
        [5, b1],
        [2, b0],
      ]),
      half: a2,
    },
    {
      distance: getProjection(t0, t1, t2, [3, 4, 5]),
      reach: getSum3([
        [5, a2],
        [4, a1],
        [3, a0],
      ]),
      half: b1,
    },
    {
      distance: getProjection(t0, t1, t2, [6, 7, 8]),
      reach: getSum3([
        [8, a2],
        [7, a1],
        [6, a0],
      ]),
      half: b2,
    },
  ]
  let result: AxisResult = {
    minimum: FLOAT32_MAXIMUM,
    axis: -1,
    firstReach: 0,
    secondReach: 0,
  }
  for (const [axis, test] of tests.entries()) {
    const next = getAxisResult(arithmetic, result, axis, test)
    if (next === undefined) return undefined
    result = next
  }
  // The nine edge-pair axes (0x00441dbf..0x00442251): (sum of extents, difference of the offset's cross).
  const edgeTests: readonly (readonly [number, number])[] = [
    [
      add(
        add(multiply(getQ(6), b1), multiply(getQ(3), b2)),
        add(multiply(getQ(2), a1), multiply(getQ(1), a2))
      ),
      subtract(multiply(t2, getR(1)), multiply(t1, getR(2))),
    ],
    [
      add(
        add(multiply(getQ(6), b0), multiply(getQ(0), b2)),
        add(multiply(getQ(5), a1), multiply(getQ(4), a2))
      ),
      subtract(multiply(t2, getR(4)), multiply(t1, getR(5))),
    ],
    [
      add(
        add(multiply(getQ(8), a1), multiply(getQ(7), a2)),
        add(multiply(getQ(3), b0), multiply(getQ(0), b1))
      ),
      subtract(multiply(t2, getR(7)), multiply(t1, getR(8))),
    ],
    [
      add(
        add(multiply(getQ(7), b1), multiply(getQ(4), b2)),
        add(multiply(getQ(2), a0), multiply(getQ(0), a2))
      ),
      subtract(multiply(t0, getR(2)), multiply(t2, getR(0))),
    ],
    [
      add(
        add(multiply(getQ(7), b0), multiply(getQ(1), b2)),
        add(multiply(getQ(5), a0), multiply(getQ(3), a2))
      ),
      subtract(multiply(t0, getR(5)), multiply(t2, getR(3))),
    ],
    [
      add(
        add(multiply(getQ(8), a0), multiply(getQ(6), a2)),
        add(multiply(getQ(4), b0), multiply(getQ(1), b1))
      ),
      subtract(multiply(t0, getR(8)), multiply(t2, getR(6))),
    ],
    [
      add(
        add(multiply(getQ(8), b1), multiply(getQ(5), b2)),
        add(multiply(getQ(1), a0), multiply(getQ(0), a1))
      ),
      subtract(multiply(t1, getR(0)), multiply(t0, getR(1))),
    ],
    [
      add(
        add(multiply(getQ(8), b0), multiply(getQ(2), b2)),
        add(multiply(getQ(4), a0), multiply(getQ(3), a1))
      ),
      subtract(multiply(t1, getR(3)), multiply(t0, getR(4))),
    ],
    [
      add(
        add(multiply(getQ(7), a0), multiply(getQ(6), a1)),
        add(multiply(getQ(5), b0), multiply(getQ(2), b1))
      ),
      subtract(multiply(t1, getR(6)), multiply(t0, getR(7))),
    ],
  ]
  for (const [extent, difference] of edgeTests) {
    const isTested =
      !getIsBelow(extent, PARALLEL_LIMIT) || getIsBelowOrEqual(extent, NEGATIVE_PARALLEL_LIMIT)
    if (isTested && !getIsBelowOrEqual(Math.abs(difference), extent)) return undefined
  }
  const axes: readonly (readonly [Matrix3, number])[] = [
    [first.rotation, 0],
    [second.rotation, 0],
    [first.rotation, 1],
    [first.rotation, 2],
    [second.rotation, 1],
    [second.rotation, 2],
  ]
  const chosen = axes[result.axis]
  const axisNormal = chosen === undefined ? ZERO_NORMAL : getRow(chosen[0], chosen[1])
  const toward = {
    x: subtract(first.centre.x, second.centre.x),
    y: subtract(first.centre.y, second.centre.y),
    z: subtract(first.centre.z, second.centre.z),
  }
  const alignment = add(
    add(multiply(toward.z, axisNormal.z), multiply(toward.y, axisNormal.y)),
    multiply(toward.x, axisNormal.x)
  )
  const normal = getIsBelow(alignment, 0)
    ? Object.freeze({ x: -axisNormal.x, y: -axisNormal.y, z: -axisNormal.z })
    : axisNormal
  return {
    depth: result.minimum,
    normal,
    firstReach: result.firstReach,
    secondReach: result.secondReach,
  }
}

// Eight corners of a box: the centre offsets 0x00441330 builds from the three scaled axes.
const getCornerOffsets = (arithmetic: FloatArithmetic, box: OrientedBox): readonly Vector3[] => {
  const { add, subtract, multiply, storeFloat, getIsEqual } = arithmetic
  const halves = [box.dimensions.x, box.dimensions.y, box.dimensions.z].map((dimension) =>
    storeFloat(multiply(dimension, HALF))
  ) as unknown as Triple
  const [row0, row1, row2] = [0, 1, 2].map((row) => getRow(box.rotation, row)) as [
    Vector3,
    Vector3,
    Vector3,
  ]
  const isScaled = box.scale !== 1
  if (isScaled && getIsEqual(box.scale, 0)) return []
  const { scale } = box
  // The first axis stays on the FPU stack, the second keeps its first component there, the third is stored.
  const first = {
    x: multiply(row0.x, halves[0]),
    y: multiply(row0.y, halves[0]),
    z: multiply(row0.z, halves[0]),
  }
  const second = {
    x: multiply(row1.x, halves[1]),
    y: storeFloat(multiply(row1.y, halves[1])),
    z: storeFloat(multiply(row1.z, halves[1])),
  }
  const third = {
    x: storeFloat(multiply(row2.x, halves[2])),
    y: storeFloat(multiply(row2.y, halves[2])),
    z: storeFloat(multiply(row2.z, halves[2])),
  }
  const axes = isScaled
    ? {
        first: {
          x: multiply(first.x, scale),
          y: multiply(first.y, scale),
          z: multiply(first.z, scale),
        },
        second: {
          x: multiply(second.x, scale),
          y: storeFloat(multiply(second.y, scale)),
          z: storeFloat(multiply(second.z, scale)),
        },
        third: {
          x: storeFloat(multiply(third.x, scale)),
          y: storeFloat(multiply(third.y, scale)),
          z: storeFloat(multiply(third.z, scale)),
        },
      }
    : { first, second, third }
  return [0, 1, 2, 3, 4, 5, 6, 7].map((corner) => {
    const isNegated = corner >= 4
    const lead = {
      x: isNegated ? -axes.first.x : axes.first.x,
      y: storeFloat(isNegated ? -axes.first.y : axes.first.y),
      z: storeFloat(isNegated ? -axes.first.z : axes.first.z),
    }
    const isSecondAdded = corner < 2 || (corner >= 4 && corner < 6)
    const withSecond = {
      x: isSecondAdded ? add(lead.x, axes.second.x) : subtract(lead.x, axes.second.x),
      y: storeFloat(isSecondAdded ? add(axes.second.y, lead.y) : subtract(lead.y, axes.second.y)),
      z: storeFloat(isSecondAdded ? add(axes.second.z, lead.z) : subtract(lead.z, axes.second.z)),
    }
    const isThirdAdded = corner % 2 === 0
    return Object.freeze({
      x: isThirdAdded ? add(withSecond.x, axes.third.x) : subtract(withSecond.x, axes.third.x),
      y: storeFloat(
        isThirdAdded ? add(axes.third.y, withSecond.y) : subtract(withSecond.y, axes.third.y)
      ),
      z: storeFloat(
        isThirdAdded ? add(axes.third.z, withSecond.z) : subtract(withSecond.z, axes.third.z)
      ),
    })
  })
}

// 0x00441330 (thiscall on the first box: second box, depth, normal, point): when the boxes overlap,
// the point is the mean of the corners of both boxes that reach the other box along the normal
// (the second box's by the negated normal); the sums are stored after every corner, and the mean
// of no corner is NaN (0 / 0), as on the FPU.
export const getBoxContact = (
  arithmetic: FloatArithmetic,
  first: OrientedBox,
  second: OrientedBox
): BoxContact | undefined => {
  const { add, divide, multiply, storeFloat, getIsBelow } = arithmetic
  const overlap = getBoxOverlap(arithmetic, first, second)
  if (overlap === undefined) return undefined
  const { normal } = overlap
  let sum: Vector3 = { x: 0, y: 0, z: 0 }
  let count = 0
  const passes: readonly (readonly [OrientedBox, number, boolean])[] = [
    [first, overlap.firstReach, false],
    [second, overlap.secondReach, true],
  ]
  for (const [box, reach, isNegated] of passes) {
    const offsets = getCornerOffsets(arithmetic, box)
    if (offsets.length === 0) return undefined
    for (const offset of offsets) {
      const projection = add(
        add(multiply(normal.y, offset.y), multiply(offset.z, normal.z)),
        multiply(offset.x, normal.x)
      )
      if (getIsBelow(isNegated ? -projection : projection, reach)) continue
      count += 1
      sum = {
        x: storeFloat(add(add(box.centre.x, sum.x), offset.x)),
        y: storeFloat(add(add(box.centre.y, sum.y), offset.y)),
        z: storeFloat(add(add(offset.z, box.centre.z), sum.z)),
      }
    }
  }
  return {
    depth: overlap.depth,
    normal,
    point: Object.freeze({
      x: storeFloat(divide(sum.x, count)),
      y: storeFloat(divide(sum.y, count)),
      z: storeFloat(divide(sum.z, count)),
    }),
  }
}
