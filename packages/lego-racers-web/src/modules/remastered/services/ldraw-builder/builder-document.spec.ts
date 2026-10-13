import {
  getReferencedModelName,
  parseBuilderDocument,
  placeReferencedParts,
  serializeBuilderDocument,
  turnQuarter,
} from './builder-document.ts'

const CAR_TEXT = [
  '0 Racers champion car RRCM',
  '0 Name: RRCM.ldr',
  '',
  '0 // chassis',
  '1 16 -99.38 9.44 -60.23 1 0 0 0 1 0 0 0 1 rrchas0.ldr',
  '0 // stripe',
  '1 4 -69.38 -46.56 -30.23 1 0 0 0 1 0 0 0 1 3623.dat',
  '1 0 -29.38 -46.56 -0.23 0 0 -1 0 1 0 1 0 0 3023.dat',
  '',
].join('\n')

describe('parseBuilderDocument', () => {
  it('splits the header, the chassis reference and the parts with their comments', () => {
    // Arrange
    const text = CAR_TEXT

    // Act
    const document = parseBuilderDocument(text)

    // Assert
    expect(document.headerLines).toEqual(['0 Racers champion car RRCM', '0 Name: RRCM.ldr'])
    expect(document.referenceLines).toEqual([
      '0 // chassis',
      '1 16 -99.38 9.44 -60.23 1 0 0 0 1 0 0 0 1 rrchas0.ldr',
    ])
    expect(document.parts.map((part) => part.partName)).toEqual(['3623.dat', '3023.dat'])
    expect(document.parts[0]?.commentLines).toEqual(['0 // stripe'])
    expect(document.parts[1]?.rotation).toEqual([0, 0, -1, 0, 1, 0, 1, 0, 0])
  })

  it('writes back the same model it read', () => {
    // Arrange
    const document = parseBuilderDocument(CAR_TEXT)

    // Act
    const text = serializeBuilderDocument(document)

    // Assert
    expect(parseBuilderDocument(text)).toEqual(document)
    expect(text).toContain('1 4 -69.38 -46.56 -30.23 1 0 0 0 1 0 0 0 1 3623.dat')
  })
})

describe('turnQuarter', () => {
  it('comes back to where it started after four turns', () => {
    // Arrange
    const start = [0, 0, -1, 0, 1, 0, 1, 0, 0]

    // Act
    const turned = turnQuarter(turnQuarter(turnQuarter(turnQuarter(start))))

    // Assert
    expect(turned.map((value) => value + 0)).toEqual(start)
  })
})

describe('placeReferencedParts', () => {
  it('moves a recipe into the car frame and gives colour 16 the line colour', () => {
    // Arrange
    const recipe = parseBuilderDocument('1 16 100 -16 60 1 0 0 0 1 0 0 0 1 30029.dat').parts

    // Act
    const placed = placeReferencedParts('1 7 -10 5 -20 1 0 0 0 1 0 0 0 1 x.ldr', recipe)

    // Assert
    expect(placed[0]?.position).toEqual([90, -11, 40])
    expect(placed[0]?.colorCode).toBe(7)
    expect(getReferencedModelName('1 16 0 0 0 1 0 0 0 1 0 0 0 1 RRchas0.ldr')).toBe('rrchas0')
  })
})
