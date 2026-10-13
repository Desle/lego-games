import {
  getReferencedModelName,
  inlineReferencedModels,
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

const DRIVER_TEXT = [
  '0 RR driver',
  '0 Name: RR.ldr',
  '0 !LDRAW_ORG Unofficial_Model',
  '0 BFC CERTIFY CCW',
  '',
  '0 !RACERS ROLE hips',
  '0 !RACERS GUESS close',
  '1 71 0 0 0 1 0 0 0 1 0 0 0 1 3815b.dat',
  '0 // head',
  '0 !RACERS ROLE head',
  '0 !RACERS GUESS exact',
  '1 14 0 -56 0 1 0 0 0 1 0 0 0 1 3626cp40.dat',
  '',
].join('\n')

describe('parseBuilderDocument with metas before parts', () => {
  it('keeps the official header metas in the header and every other meta with the part after it', () => {
    // Arrange
    const text = DRIVER_TEXT

    // Act
    const document = parseBuilderDocument(text)

    // Assert
    expect(document.headerLines).toEqual([
      '0 RR driver',
      '0 Name: RR.ldr',
      '0 !LDRAW_ORG Unofficial_Model',
      '0 BFC CERTIFY CCW',
    ])
    expect(document.parts.map((part) => part.commentLines)).toEqual([
      ['0 !RACERS ROLE hips', '0 !RACERS GUESS close'],
      ['0 // head', '0 !RACERS ROLE head', '0 !RACERS GUESS exact'],
    ])
  })

  it('writes every meta back before its own part, also after the parts are edited', () => {
    // Arrange
    const document = parseBuilderDocument(DRIVER_TEXT)
    const [hips, head] = document.parts
    const edited = { ...document, parts: [head, hips].filter((part) => part !== undefined) }

    // Act
    const lines = serializeBuilderDocument(edited).split('\n')

    // Assert
    expect(lines.slice(lines.indexOf('0 // head'))).toEqual([
      '0 // head',
      '0 !RACERS ROLE head',
      '0 !RACERS GUESS exact',
      '1 14 0 -56 0 1 0 0 0 1 0 0 0 1 3626cp40.dat',
      '0 !RACERS ROLE hips',
      '0 !RACERS GUESS close',
      '1 71 0 0 0 1 0 0 0 1 0 0 0 1 3815b.dat',
      '',
    ])
    expect(parseBuilderDocument(serializeBuilderDocument(document))).toEqual(document)
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

describe('inlineReferencedModels', () => {
  it('turns a car on its chassis recipe into one flat model with the recipe parts in the car frame', () => {
    // Arrange
    const car = parseBuilderDocument(CAR_TEXT)
    const recipe = parseBuilderDocument('1 16 100 -16 60 1 0 0 0 1 0 0 0 1 30029.dat').parts

    // Act
    const flat = inlineReferencedModels(car, new Map([['rrchas0', recipe]]))

    // Assert
    expect(flat.referenceLines).toEqual([])
    expect(flat.parts.map((part) => part.partName)).toEqual(['30029.dat', '3623.dat', '3023.dat'])
    expect(flat.parts[0]?.position.map((value) => Number(value.toFixed(2)))).toEqual([
      0.62, -6.56, -0.23,
    ])
    expect(flat.parts[0]?.commentLines).toEqual(['0 // chassis'])
    expect(serializeBuilderDocument(flat)).not.toContain('rrchas0.ldr')
  })

  it('keeps a reference whose model is not given', () => {
    // Arrange
    const car = parseBuilderDocument(CAR_TEXT)

    // Act
    const kept = inlineReferencedModels(car, new Map())

    // Assert
    expect(kept.referenceLines).toEqual(car.referenceLines)
    expect(kept.parts).toEqual(car.parts)
  })
})
