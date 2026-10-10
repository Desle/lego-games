import { UnportableCheckpointsError } from '../../types/checkpoint-errors/checkpoint-errors.ts'
import { assignCheckpointProgress } from './assign-checkpoint-progress.ts'

const NONE = 0xff

describe('assignCheckpointProgress', () => {
  it('spreads 0..1 over the next-link loop in float32 steps', () => {
    // Arrange
    const links = [
      [1, NONE, NONE, NONE],
      [2, NONE, NONE, NONE],
      [0, NONE, NONE, NONE],
    ]

    // Act
    const progress = assignCheckpointProgress(links)

    // Assert
    const step = Math.fround(1 / 3)
    expect(progress).toEqual([0, step, Math.fround(step + step)])
  })

  it('interpolates a branch between where it leaves and where it rejoins', () => {
    // Arrange
    const links = [
      [1, 3, NONE, NONE],
      [2, NONE, NONE, NONE],
      [0, NONE, NONE, NONE],
      [4, NONE, NONE, NONE],
      [2, NONE, NONE, NONE],
    ]

    // Act
    const progress = assignCheckpointProgress(links)

    // Assert
    const step = Math.fround(1 / 3)
    const end = Math.fround(step + step)
    const delta = end / 3
    expect(progress).toEqual([0, step, end, Math.fround(delta), Math.fround(delta + delta)])
  })

  it('refuses a link outside the checkpoint array', () => {
    // Arrange
    const links = [[5, NONE, NONE, NONE]]

    // Act
    const assign = () => assignCheckpointProgress(links)

    // Assert
    expect(assign).toThrow(UnportableCheckpointsError)
  })

  it('refuses an empty checkpoint array, which the original dereferences', () => {
    // Arrange
    const links: readonly (readonly number[])[] = []

    // Act
    const assign = () => assignCheckpointProgress(links)

    // Assert
    expect(assign).toThrow(UnportableCheckpointsError)
  })
})
