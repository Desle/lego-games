import {
  compareSilhouettes,
  getChassisScore,
  getCoverageMask,
  getFidelityScore,
  getLab,
  getMeanColorDifference,
} from './fidelity-metrics.ts'

const WIDTH = 4

// A 4 x 4 mask with the cells of these indices covered.
const getMask = (covered: readonly number[]): Uint8Array =>
  Uint8Array.from({ length: WIDTH * WIDTH }, (_unused, index) => (covered.includes(index) ? 1 : 0))

const getPixels = (colors: readonly (readonly [number, number, number, number])[]): Uint8Array =>
  Uint8Array.from(colors.flat())

describe('getCoverageMask', () => {
  it('marks the white pixels of a silhouette pass', () => {
    // Arrange
    const pixels = getPixels([
      [255, 255, 255, 255],
      [0, 0, 0, 0],
    ])
    // Act
    const mask = getCoverageMask(pixels)
    // Assert
    expect([...mask]).toEqual([1, 0])
  })
})

describe('compareSilhouettes', () => {
  it('gives the overlap and the offset of the centres of area', () => {
    // Arrange
    const original = getMask([0, 1, 4, 5])
    const replacement = getMask([1, 2, 5, 6])
    // Act
    const comparison = compareSilhouettes(original, replacement, WIDTH)
    // Assert
    expect(comparison.intersectionOverUnion).toBeCloseTo(2 / 6)
    expect(comparison.centroidOffset).toEqual([1, 0])
    expect(comparison.originalArea).toBe(4)
  })

  it('agrees when both are empty and has no overlap when one is', () => {
    // Arrange
    const empty = getMask([])
    // Act
    const bothEmpty = compareSilhouettes(empty, empty, WIDTH)
    const oneEmpty = compareSilhouettes(getMask([3]), empty, WIDTH)
    // Assert
    expect(bothEmpty.intersectionOverUnion).toBe(1)
    expect(oneEmpty.intersectionOverUnion).toBe(0)
  })
})

describe('getLab', () => {
  it('puts white at lightness 100 and black at 0', () => {
    // Arrange
    const white = [255, 255, 255] as const
    // Act
    const [whiteLightness, whiteA, whiteB] = getLab(...white)
    const [blackLightness] = getLab(0, 0, 0)
    // Assert
    expect(whiteLightness).toBeCloseTo(100, 1)
    expect(Math.abs(whiteA)).toBeLessThan(0.1)
    expect(Math.abs(whiteB)).toBeLessThan(0.1)
    expect(blackLightness).toBeCloseTo(0)
  })
})

describe('getMeanColorDifference', () => {
  it('averages over the pixels both drawings cover', () => {
    // Arrange
    const original = getPixels([
      [255, 255, 255, 255],
      [255, 0, 0, 255],
    ])
    const replacement = getPixels([
      [0, 0, 0, 255],
      [0, 0, 255, 255],
    ])
    const mask = Uint8Array.from([1, 0])
    // Act
    const difference = getMeanColorDifference(original, replacement, mask, mask)
    // Assert
    expect(difference).toBeCloseTo(100, 0)
  })

  it('is null when nothing is shared', () => {
    // Arrange
    const pixels = getPixels([[1, 2, 3, 255]])
    // Act
    const difference = getMeanColorDifference(
      pixels,
      pixels,
      Uint8Array.from([1]),
      Uint8Array.from([0])
    )
    // Assert
    expect(difference).toBeNull()
  })
})

describe('getFidelityScore', () => {
  it('is 100 for a perfect match and drops the parts an item cannot measure', () => {
    // Arrange
    const perfect = {
      meanIntersectionOverUnion: 1,
      centroidDistance: 0,
      scaleRatio: 1,
      meanColorDifference: null,
      meanAnchorDistance: null,
    }
    // Act
    const score = getFidelityScore(perfect)
    // Assert
    expect(score).toBe(100)
  })

  it('is 0 when nothing matches', () => {
    // Arrange
    const unrelated = {
      meanIntersectionOverUnion: 0.2,
      centroidDistance: 40,
      scaleRatio: 2,
      meanColorDifference: 60,
      meanAnchorDistance: 30,
    }
    // Act
    const score = getFidelityScore(unrelated)
    // Assert
    expect(score).toBe(0)
  })

  it('weighs the silhouette half of the score', () => {
    // Arrange
    const shapeWrong = {
      meanIntersectionOverUnion: 0.5,
      centroidDistance: 0,
      scaleRatio: 1,
      meanColorDifference: 0,
      meanAnchorDistance: 0,
    }
    // Act
    const score = getFidelityScore(shapeWrong)
    // Assert
    expect(score).toBe(50)
  })
})

describe('getChassisScore', () => {
  it('judges a recipe by its wheel hubs, its grid shift and its building cells, not its shape', () => {
    // Arrange
    const holding = { meanWheelHubDistance: 0, gridDistance: 0, footprintCoverage: 1 }
    const wheelsOff = { meanWheelHubDistance: 10, gridDistance: 0, footprintCoverage: 1 }
    const noWheels = { meanWheelHubDistance: null, gridDistance: 5, footprintCoverage: 0.75 }
    // Act
    const holdingScore = getChassisScore(holding)
    const wheelsOffScore = getChassisScore(wheelsOff)
    const noWheelsScore = getChassisScore(noWheels)
    // Assert
    expect(holdingScore).toBe(100)
    expect(wheelsOffScore).toBe(60)
    expect(noWheelsScore).toBe(50)
  })
})
