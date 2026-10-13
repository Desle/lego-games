import { getParticlePieceScale, PARTICLE_PIECE_MAXIMUM_WIDTH } from './ldraw-particle-size.ts'

describe('getParticlePieceScale', () => {
  it('shrinks a piece to a quad narrower than it', () => {
    // Arrange: a car's dust a stud across, a spark a tenth of one, a piece a stud wide
    const quads = [
      [1, 1],
      [0.1, 0.1],
    ] as const

    // Act
    const scales = quads.map(([width, height]) => getParticlePieceScale(width, height, 1))

    // Assert
    expect(scales).toEqual([1, 0.1])
  })

  it("never stretches a piece over a big quad: a turbo's smoke stays the piece's own size", () => {
    // Arrange: the turbo's first quad (8 studs) and its last (12)
    const sizes = [8, 12]

    // Act
    const scales = sizes.map((size) => getParticlePieceScale(size, size, 1))

    // Assert
    expect(scales).toEqual([1, 1])
  })

  it('caps a piece a file scaled up past the maximum width', () => {
    // Arrange: a file scaled to 5 studs
    const pieceWidth = 5

    // Act
    const scale = getParticlePieceScale(12, 12, pieceWidth)

    // Assert
    expect(scale * pieceWidth).toBe(PARTICLE_PIECE_MAXIMUM_WIDTH)
  })

  it('draws nothing before the piece is known or for a quad of no size', () => {
    // Arrange
    const cases = [
      [4, 4, 0],
      [0, 4, 1],
    ] as const

    // Act
    const scales = cases.map(([width, height, pieceWidth]) =>
      getParticlePieceScale(width, height, pieceWidth)
    )

    // Assert
    expect(scales).toEqual([0, 0])
  })
})
