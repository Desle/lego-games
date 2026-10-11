import { getFinishMusic, getIntroductionMusic, getRacingMusic } from './race-music.ts'

describe('race music', () => {
  it('plays entry 0 once during the introduction', () => {
    // Arrange / Act
    const cue = getIntroductionMusic()

    // Assert
    expect(cue).toMatchObject({ listIndex: 0, isLooping: false })
  })

  it.each([
    [0, 1],
    [1, 4],
    [2, 5],
    [3, 6],
  ])('picks entry %i of the racing choice for a draw of that remainder', (remainder, expected) => {
    // Arrange: a seven-entry list takes the draw modulo 4
    const draw = () => 4 * 10 + remainder

    // Act
    const cue = getRacingMusic(7, draw)

    // Assert
    expect(cue).toMatchObject({ listIndex: expected, isLooping: true })
  })

  it('plays entry 1 without drawing for a list of four or fewer entries', () => {
    // Arrange
    const draw = vi.fn(() => 3)

    // Act
    const cue = getRacingMusic(4, draw)

    // Assert
    expect(cue.listIndex).toBe(1)
    expect(draw).not.toHaveBeenCalled()
  })

  it('plays the win entry for first place and the lose entry otherwise', () => {
    // Arrange / Act
    const first = getFinishMusic(1)
    const other = getFinishMusic(4)

    // Assert
    expect(first).toMatchObject({ listIndex: 3, isLooping: false })
    expect(other).toMatchObject({ listIndex: 2, isLooping: false })
  })
})
