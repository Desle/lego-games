import { getDesign, getRecord } from './opponent-car-records.ts'
import type { OpponentCarDesign } from './opponent-car.types.ts'

describe('opponent car records', () => {
  it('turns a design into a record and back', () => {
    // Arrange
    const design: OpponentCarDesign = {
      modelName: 'TESTCM',
      note: 'a note',
      offset: [0.25, 0.5, 0.1],
      bricks: [
        ['L300400', -3, 2, 1, 5, 0],
        ['ldraw:3020', 0, 0, 0, 1, 3],
      ],
      coveredTriangles: [4, 7, 9],
    }

    // Act
    const record = getRecord(design)
    const restored = getDesign(record)

    // Assert
    expect(record.bricks).toBe('L300400 -3 2 1 5 0;ldraw:3020 0 0 0 1 3')
    expect(restored).toEqual(design)
  })
})
