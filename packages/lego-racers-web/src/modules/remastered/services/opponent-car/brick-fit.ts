import { BRICK_COLOR_COUNT } from './body-colors.ts'
import type { FittedBrick, FittedBricks } from './brick-fit.types.ts'
import type { BodyVoxels, BrickTemplate } from './opponent-car.types.ts'

// What a brick costs: a placement must gain more than this many filled cells to be worth a brick.
const BRICK_COST = 1
// How much of a template's gain a split of its cells over several colours takes away (all cells in two colours: this much).
const COLOR_MISMATCH_WEIGHT = 0.8
const NOT_PLACEABLE = -Infinity

const getCellIndex = (voxels: BodyVoxels, x: number, y: number, z: number): number =>
  (z * voxels.grid.countY + y) * voxels.grid.countX + x

// The cells' summed colour votes: how many cells carry votes, and the share of the votes the strongest colour has.
const getColorAgreement = (voxels: BodyVoxels, cellIndices: readonly number[]) => {
  const totals = new Float32Array(BRICK_COLOR_COUNT)
  for (const cell of cellIndices) {
    for (let color = 0; color < BRICK_COLOR_COUNT; color += 1) {
      totals[color] =
        (totals[color] ?? 0) + (voxels.colorVotes[cell * BRICK_COLOR_COUNT + color] ?? 0)
    }
  }
  const sum = totals.reduce((total, vote) => total + vote, 0)
  const strongest = Math.max(...totals)
  return { sum, strongest, color: totals.indexOf(strongest) }
}

// Fits bricks to the body, one at a time: each round places the template whose cells, none of them taken, are the most worth
// covering (a cell the body fills at least half of gains up to 1, an empty one loses 1, a split in colours takes some away).
export const fitBodyBricks = (
  voxels: BodyVoxels,
  templates: readonly BrickTemplate[]
): FittedBricks => {
  const { grid } = voxels
  const cellCount = grid.countX * grid.countY * grid.countZ
  const taken = new Uint8Array(cellCount)
  const getCells = (template: BrickTemplate, x: number, y: number, z: number) => {
    const cells: number[] = []
    for (let index = 0; index < template.cells.length; index += 3) {
      const cellX = x + (template.cells[index] ?? 0)
      const cellY = y + (template.cells[index + 1] ?? 0)
      const cellZ = z + (template.cells[index + 2] ?? 0)
      if (
        cellX >= grid.countX ||
        cellY >= grid.countY ||
        cellZ >= grid.countZ ||
        taken[getCellIndex(voxels, cellX, cellY, cellZ)] === 1
      )
        return null
      cells.push(getCellIndex(voxels, cellX, cellY, cellZ))
    }
    return cells
  }
  const getGain = (template: BrickTemplate, x: number, y: number, z: number): number => {
    const cells = getCells(template, x, y, z)
    if (cells === null) return NOT_PLACEABLE
    const shape = cells.reduce((total, cell) => total + 2 * (voxels.fill[cell] ?? 0) - 1, 0)
    const { sum, strongest } = getColorAgreement(voxels, cells)
    const disagreement = sum > 0 ? 1 - strongest / sum : 0
    return shape * (1 - COLOR_MISMATCH_WEIGHT * disagreement) - BRICK_COST
  }
  const gains = templates.map(() => new Float32Array(cellCount).fill(NOT_PLACEABLE))
  const refresh = (
    templateIndex: number,
    template: BrickTemplate,
    firstX: number,
    lastX: number,
    firstY: number,
    lastY: number,
    firstZ: number,
    lastZ: number
  ) => {
    for (let z = Math.max(0, firstZ); z <= Math.min(grid.countZ - 1, lastZ); z += 1) {
      for (let y = Math.max(0, firstY); y <= Math.min(grid.countY - 1, lastY); y += 1) {
        for (let x = Math.max(0, firstX); x <= Math.min(grid.countX - 1, lastX); x += 1) {
          const cellGains = gains[templateIndex]
          if (cellGains !== undefined)
            cellGains[getCellIndex(voxels, x, y, z)] = getGain(template, x, y, z)
        }
      }
    }
  }
  templates.forEach((template, templateIndex) =>
    refresh(templateIndex, template, 0, grid.countX, 0, grid.countY, 0, grid.countZ)
  )
  const bricks: FittedBrick[] = []
  let totalGain = 0
  for (;;) {
    let bestGain = 0
    let bestTemplate = -1
    let bestCell = -1
    for (const [templateIndex, cellGains] of gains.entries()) {
      for (const [cell, gain] of cellGains.entries()) {
        if (gain > bestGain) {
          bestGain = gain
          bestTemplate = templateIndex
          bestCell = cell
        }
      }
    }
    const template = templates[bestTemplate]
    if (template === undefined) break
    const x = bestCell % grid.countX
    const y = Math.floor(bestCell / grid.countX) % grid.countY
    const z = Math.floor(bestCell / (grid.countX * grid.countY))
    const cells = getCells(template, x, y, z) ?? []
    const { sum, color } = getColorAgreement(voxels, cells)
    for (const cell of cells) taken[cell] = 1
    totalGain += bestGain
    bricks.push({
      pieceName: template.pieceName,
      orientation: template.orientation,
      x,
      y,
      z,
      colorIndex: sum > 0 ? color : -1,
    })
    templates.forEach((other, otherIndex) =>
      refresh(
        otherIndex,
        other,
        x - other.countX + 1,
        x + template.countX - 1,
        y - other.countY + 1,
        y + template.countY - 1,
        z - other.countZ + 1,
        z + template.countZ - 1
      )
    )
  }
  return { bricks, totalGain }
}
