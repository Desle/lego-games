import type { BrickFootprint } from '@lego-games/lego-racers/car-builder'
import type { GridOffset } from './chassis-grid-offset.types.ts'
import type { DeckStud, PointGroupBox } from './chassis-footprint-coverage.types.ts'

const LDRAW_UNITS_PER_STUD = 20
const COORDINATES_PER_POINT = 3
const ATTACHABLE_TOP_FLAG = 0x80
const DECK_TOLERANCE = 1
// The points of one stud's top lie on its 12 LDU circle and the tops of two studs are 8 LDU apart: closer points are one stud.
const STUD_LINK_DISTANCE = 7
const STUD_TOP_DIAMETER = 12
const STUD_TOP_SLACK = 2
const CELL_ON_STUD_DISTANCE = 2

const getTopPoints = (positions: readonly number[]): readonly (readonly [number, number])[] => {
  let top = Infinity
  for (let index = 1; index < positions.length; index += COORDINATES_PER_POINT) {
    top = Math.min(top, positions[index] ?? Infinity)
  }
  const points: (readonly [number, number])[] = []
  for (let index = 0; index < positions.length; index += COORDINATES_PER_POINT) {
    if ((positions[index + 1] ?? Infinity) > top + DECK_TOLERANCE) continue
    points.push([positions[index] ?? 0, positions[index + 2] ?? 0])
  }
  return points
}

const getGroupRoots = (points: readonly (readonly [number, number])[]): readonly number[] => {
  const parents = points.map((_point, index) => index)
  const findRoot = (index: number): number => {
    let root = index
    while (parents[root] !== root) root = parents[root] ?? root
    return root
  }
  for (const [first, [firstX, firstZ]] of points.entries()) {
    for (let second = first + 1; second < points.length; second += 1) {
      const [secondX, secondZ] = points[second] ?? [0, 0]
      if (Math.hypot(firstX - secondX, firstZ - secondZ) > STUD_LINK_DISTANCE) continue
      parents[findRoot(second)] = findRoot(first)
    }
  }
  return points.map((_point, index) => findRoot(index))
}

const getIsStudTop = (box: PointGroupBox): boolean =>
  Math.abs(box.maximumX - box.minimumX - STUD_TOP_DIAMETER) <= STUD_TOP_SLACK &&
  Math.abs(box.maximumZ - box.minimumZ - STUD_TOP_DIAMETER) <= STUD_TOP_SLACK

// The centres of the studs on a base's deck (its highest level) from its points (x, y, z in turn, recipe axes): the highest points fall
// apart into one circle per stud; a group of another size is a flat top, not a stud.
export const getDeckStuds = (positions: readonly number[]): readonly DeckStud[] => {
  const points = getTopPoints(positions)
  const roots = getGroupRoots(points)
  const boxes = new Map<number, PointGroupBox>()
  for (const [index, [x, z]] of points.entries()) {
    const root = roots[index] ?? index
    const box = boxes.get(root)
    boxes.set(
      root,
      Object.freeze({
        minimumX: Math.min(box?.minimumX ?? x, x),
        maximumX: Math.max(box?.maximumX ?? x, x),
        minimumZ: Math.min(box?.minimumZ ?? z, z),
        maximumZ: Math.max(box?.maximumZ ?? z, z),
      })
    )
  }
  return [...boxes.values()].filter(getIsStudTop).map((box) =>
    Object.freeze({
      x: (box.minimumX + box.maximumX) / 2,
      z: (box.minimumZ + box.maximumZ) / 2,
    })
  )
}

// The share of the chassis footprint's building cells (its attachable ones) that land on a stud of the base's deck once the grid is
// shifted by `offset`: on a real base a cell off every stud holds no brick.
export const getFootprintCoverage = (
  footprint: BrickFootprint,
  offset: GridOffset,
  studs: readonly DeckStud[]
): number => {
  let attachable = 0
  let covered = 0
  for (let x = 0; x < footprint.width; x += 1) {
    for (let y = 0; y < footprint.height; y += 1) {
      const top = footprint.cells[(x * footprint.height + y) * 2] ?? 0
      if ((top & ATTACHABLE_TOP_FLAG) === 0) continue
      attachable += 1
      const centreX = (x + 0.5) * LDRAW_UNITS_PER_STUD + offset.x
      const centreZ = (y + 0.5) * LDRAW_UNITS_PER_STUD + offset.z
      const isOnStud = studs.some(
        (stud) => Math.hypot(stud.x - centreX, stud.z - centreZ) <= CELL_ON_STUD_DISTANCE
      )
      if (isOnStud) covered += 1
    }
  }
  return attachable === 0 ? 0 : covered / attachable
}
