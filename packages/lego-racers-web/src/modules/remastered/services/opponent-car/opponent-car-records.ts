import type { OpponentBrick, OpponentCarDesign, OpponentCarRecord } from './opponent-car.types.ts'

const BRICK_SEPARATOR = ';'
const FIELD_SEPARATOR = ' '
const TRIANGLE_SEPARATOR = ','

// The design as the data file holds it: the bricks and the covered triangles as one string each (a long list of numbers is
// not worth a line each).
export const getRecord = (design: OpponentCarDesign): OpponentCarRecord => ({
  modelName: design.modelName,
  note: design.note,
  offset: design.offset,
  bricks: design.bricks.map((brick) => brick.join(FIELD_SEPARATOR)).join(BRICK_SEPARATOR),
  coveredTriangles: design.coveredTriangles.join(TRIANGLE_SEPARATOR),
})

const getBrick = (text: string): OpponentBrick => {
  const [name = '', x, y, orientation, colorIndex, baseHeight] = text.split(FIELD_SEPARATOR)
  return [name, Number(x), Number(y), Number(orientation), Number(colorIndex), Number(baseHeight)]
}

export const getDesign = (record: OpponentCarRecord): OpponentCarDesign => ({
  modelName: record.modelName,
  note: record.note,
  offset: record.offset,
  bricks: record.bricks === '' ? [] : record.bricks.split(BRICK_SEPARATOR).map(getBrick),
  coveredTriangles:
    record.coveredTriangles === ''
      ? []
      : record.coveredTriangles.split(TRIANGLE_SEPARATOR).map(Number),
})
