import { BspTreeNodeKind, NO_NODE_INDEX } from '../../../bsp-tree/index.ts'
import type { BspTree, BspTreeNode } from '../../../bsp-tree/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { DecalFrame, DecalPlane } from '../../types/decal.types.ts'

const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } =
  createFloatArithmetic(RACE_FPU_PRECISION)

const HALF = 0.5

// 0x00415a60: the five points the BSP query tests: the decal's position, then the corners of its box (the lower pair
// at the reach of the projection, the upper pair on the picture's plane), each stored as a float.
export const getDecalQueryPoints = (frame: DecalFrame): readonly Vector3[] => {
  const halfWidth = storeFloat(multiply(frame.width, HALF))
  const halfHeight = storeFloat(multiply(frame.height, HALF))
  const right = {
    x: multiply(halfWidth, frame.right.x),
    y: multiply(frame.right.y, halfWidth),
    z: multiply(halfWidth, frame.right.z),
  }
  const up = {
    x: multiply(halfHeight, frame.up.x),
    y: multiply(frame.up.y, halfHeight),
    z: multiply(halfHeight, frame.up.z),
  }
  const { position, normal, depth } = frame
  const reach = {
    x: add(subtract(position.x, up.x), multiply(depth, normal.x)),
    y: add(subtract(position.y, up.y), multiply(normal.y, depth)),
    z: add(multiply(depth, normal.z), subtract(position.z, up.z)),
  }
  const top = {
    x: add(up.x, position.x),
    y: add(up.y, position.y),
    z: add(up.z, position.z),
  }
  const getPoint = (base: Vector3, sign: number): Vector3 =>
    Object.freeze({
      x: storeFloat(sign < 0 ? subtract(base.x, right.x) : add(base.x, right.x)),
      y: storeFloat(sign < 0 ? subtract(base.y, right.y) : add(base.y, right.y)),
      z: storeFloat(sign < 0 ? subtract(base.z, right.z) : add(base.z, right.z)),
    })
  return Object.freeze([
    position,
    getPoint(reach, -1),
    getPoint(reach, 1),
    getPoint(top, -1),
    getPoint(top, 1),
  ])
}

// The first test of 0x00403cc0 (descent from the root): `0 <= ((x·nx + ny·y) + nz·z) + d`.
const getIsPointInFront = (plane: DecalPlane, point: Vector3): boolean =>
  getIsBelowOrEqual(
    0,
    add(
      add(
        add(multiply(point.x, plane[0]), multiply(plane[1], point.y)),
        multiply(plane[2], point.z)
      ),
      plane[3]
    )
  )

// The probes of 0x00403cc0 compare `n · p` with `-d`.
const getDotProduct = (plane: DecalPlane, point: Vector3): number =>
  add(add(multiply(plane[0], point.x), multiply(plane[1], point.y)), multiply(plane[2], point.z))

const getIsBranch = (node: BspTreeNode): boolean => node.kind === BspTreeNodeKind.BRANCH

// 0x00403cc0 (decal tree, points, count): the leaves a decal touches, in the order the engine links them. The leaf
// holding the first point comes first; then, climbing back up from it, the far side of each plane is visited when any
// of the other points lies strictly on it. A subtree entered that way follows the first point's side first. (The engine
// keeps the walk in per-node stamps and a linked list; this is the same walk written as a recursion.)
export const getDecalLeaves = (tree: BspTree, points: readonly Vector3[]): readonly number[] => {
  const leaves: number[] = []
  const [first = { x: 0, y: 0, z: 0 }, ...probes] = points
  const getPlane = (node: BspTreeNode): DecalPlane => node.keyword28Floats
  const isAnyProbeInFront = (plane: DecalPlane): boolean =>
    probes.some((probe) => getIsBelow(-plane[3], getDotProduct(plane, probe)))
  const isAnyProbeBehind = (plane: DecalPlane): boolean =>
    probes.some((probe) => getIsBelow(getDotProduct(plane, probe), -plane[3]))
  const visitOtherSide = (node: BspTreeNode, isFrontFirst: boolean) => {
    const [frontChild, backChild] = node.childIndices
    const plane = getPlane(node)
    if (isFrontFirst) {
      if (backChild !== NO_NODE_INDEX && isAnyProbeBehind(plane)) visitEntered(backChild)
    } else if (frontChild !== NO_NODE_INDEX && isAnyProbeInFront(plane)) {
      visitEntered(frontChild)
    }
  }
  // A subtree entered from a probe: the first point's side first (a missing child skips it).
  const visitEntered = (index: number) => {
    const node = tree.nodes[index]
    if (node === undefined) return
    if (!getIsBranch(node)) {
      leaves.push(index)
      return
    }
    const plane = getPlane(node)
    const isFront = getIsBelowOrEqual(-plane[3], getDotProduct(plane, first))
    const child = node.childIndices[isFront ? 0 : 1]
    if (child !== NO_NODE_INDEX) visitEntered(child)
    visitOtherSide(node, isFront)
  }
  // The descent from the root to the first point's leaf, then each ancestor's far side from the deepest up.
  const visitFirst = (index: number) => {
    const node = tree.nodes[index]
    if (node === undefined) return
    if (!getIsBranch(node)) {
      leaves.push(index)
      return
    }
    const [frontChild, backChild] = node.childIndices
    const isFront = getIsPointInFront(getPlane(node), first) || backChild === NO_NODE_INDEX
    const next = isFront ? (frontChild === NO_NODE_INDEX ? backChild : frontChild) : backChild
    visitFirst(next)
    visitOtherSide(node, isFront && frontChild !== NO_NODE_INDEX)
  }
  if (tree.rootIndex !== null) visitFirst(tree.rootIndex)
  return Object.freeze(leaves)
}
