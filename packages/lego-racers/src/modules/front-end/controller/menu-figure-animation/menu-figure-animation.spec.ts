import { getShownClipIndex } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { MenuFigureAnimation } from '../../types/menu-figure/menu-figure-animation.types.ts'
import {
  createMenuFigureAnimation,
  restartMenuFigureAnimation,
  stepMenuFigureAnimation,
} from './menu-figure-animation.ts'

const FRAME_MILLISECONDS = 33
const getClip = (frameCount: number) => ({
  name: 'clip',
  framesPerMillisecond: 0.03,
  velocity: [0, 0, 0] as const,
  boundingSphere: [0, 0, 0, 0] as const,
  firstTrackIndex: 0,
  frameCount,
  loopLength: frameCount + 1,
})
// The clips of LEGOMAN.ADB: start, begin and wait.
const ANIMATION: SkeletalAnimation = {
  positions: [],
  rotations: [],
  times: [],
  tracks: [],
  clips: [getClip(329), getClip(103), getClip(395)],
}

const run = (
  figure: MenuFigureAnimation,
  milliseconds: number
): { readonly figure: MenuFigureAnimation; readonly soundNames: readonly string[] } => {
  let current = figure
  const soundNames: string[] = []
  for (let elapsed = 0; elapsed < milliseconds; elapsed += FRAME_MILLISECONDS) {
    const step = stepMenuFigureAnimation(current, ANIMATION, FRAME_MILLISECONDS)
    current = step.figure
    soundNames.push(...step.soundNames)
  }
  return { figure: current, soundNames }
}

describe('menu figure animation', () => {
  it('plays start once, then loops begin', () => {
    // Arrange
    const figure = createMenuFigureAnimation(ANIMATION)

    // Act
    const early = run(figure, 5000)
    const later = run(figure, 20000)

    // Assert
    expect(getShownClipIndex(early.figure.animation)).toBe(0)
    expect(getShownClipIndex(later.figure.animation)).toBe(1)
    expect(later.figure.animation.isLooping).toBe(true)
  })

  it('waits at the glass after 30 seconds, taps once, and returns to begin', () => {
    // Arrange
    const figure = createMenuFigureAnimation(ANIMATION)

    // Act
    const waiting = run(figure, 31000)
    const finished = run(figure, 50000)

    // Assert
    expect(getShownClipIndex(waiting.figure.animation)).toBe(2)
    expect(finished.soundNames).toEqual(['glasstap'])
    expect(getShownClipIndex(finished.figure.animation)).toBe(1)
  })

  it('restarts start when the screen is entered again and keeps the timers', () => {
    // Arrange
    const figure = run(createMenuFigureAnimation(ANIMATION), 20000).figure

    // Act
    const restarted = restartMenuFigureAnimation(figure, ANIMATION)

    // Assert
    expect(getShownClipIndex(restarted.animation)).toBe(0)
    expect(restarted.idleMilliseconds).toBe(figure.idleMilliseconds)
  })
})
