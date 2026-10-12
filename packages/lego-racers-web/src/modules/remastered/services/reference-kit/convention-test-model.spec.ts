import { Vector3 } from 'three'
import { LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import { CONVENTION_MARKERS, getConventionTestText } from './convention-test-model.ts'

const roundToHundredths = (value: number): number => Math.round(value * 100) / 100

const PART_LINE = /^1\s+(\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s/

const getMarkerPositions = (): readonly Vector3[] =>
  getConventionTestText()
    .split('\n')
    .flatMap((line) => {
      const match = PART_LINE.exec(line)
      return match === null
        ? []
        : [new Vector3(Number(match[2]), Number(match[3]), Number(match[4]))]
    })

describe('the convention test model', () => {
  it('puts every marker where the car frame says once the file is turned into studs', () => {
    // Arrange
    const positions = getMarkerPositions()

    // Act
    const studs = positions.map((position) => position.applyMatrix4(LDRAW_TO_STUDS))

    // Assert
    expect(studs.map((stud) => stud.toArray().map(roundToHundredths))).toEqual(
      CONVENTION_MARKERS.map((marker) => marker.expected.map(roundToHundredths))
    )
  })

  it('has the front ahead of the origin, the left side to the left and the tower above', () => {
    // Arrange
    const [origin, front, left, , , top] = getMarkerPositions().map((position) =>
      position.applyMatrix4(LDRAW_TO_STUDS)
    )

    // Act
    const directions = [
      (front?.x ?? 0) > (origin?.x ?? 0),
      (left?.y ?? 0) > (origin?.y ?? 0),
      (top?.z ?? 0) > (origin?.z ?? 0),
    ]

    // Assert
    expect(directions).toEqual([true, true, true])
  })
})
