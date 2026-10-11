import { getIntroductionMusic, getTuneMusic } from './race-music.ts'

describe('race music', () => {
  it('plays entry 0 once during the introduction', () => {
    // Arrange / Act
    const cue = getIntroductionMusic()

    // Assert
    expect(cue).toMatchObject({ listIndex: 0, isLooping: false })
  })

  it.each([1, 4, 5, 6])('loops racing entry %i', (tuneIndex) => {
    // Arrange / Act
    const cue = getTuneMusic(tuneIndex)

    // Assert
    expect(cue).toMatchObject({ listIndex: tuneIndex, isLooping: true, address: '0x00434b00' })
  })

  it.each([2, 3])('plays finish entry %i once', (tuneIndex) => {
    // Arrange / Act
    const cue = getTuneMusic(tuneIndex)

    // Assert
    expect(cue).toMatchObject({ listIndex: tuneIndex, isLooping: false, address: '0x00434c80' })
  })
})
