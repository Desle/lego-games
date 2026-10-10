import type { AnimationClip } from '../../types/skeletal-animation.types.ts'
import { getWrappedTime } from './get-wrapped-time.ts'

const clip: AnimationClip = {
  name: 'walk',
  framesPerMillisecond: 1,
  velocity: [0, 0, 0],
  firstTrackIndex: 0,
  frameCount: 11,
  loopLength: 10,
}

describe('getWrappedTime', () => {
  it('leaves a time below the loop length alone', () => {
    // Arrange
    // Act
    const time = getWrappedTime(clip, 9.5)

    // Assert
    expect(time).toBe(9.5)
  })

  it('removes whole loops from a time at or past the loop length', () => {
    // Arrange
    // Act
    const exactly = getWrappedTime(clip, 10)
    const later = getWrappedTime(clip, 27.5)

    // Assert
    expect(exactly).toBe(0)
    expect(later).toBe(7.5)
  })

  it('returns the time unchanged for a clip with a loop length of 0', () => {
    // Arrange
    // Act
    const time = getWrappedTime({ ...clip, loopLength: 0 }, 5)

    // Assert
    expect(time).toBe(5)
  })
})
