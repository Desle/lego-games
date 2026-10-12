import type { Cinema, CinemaAction, CinemaDummy } from '../../types/cinema.types.ts'

const MILLISECONDS_PER_SECOND = 1000

// What a cinema shows at a time: the cinema loops (the race previews run on; measured, see menu-backdrops.md), so the
// clock inside the loop is the time modulo the cinema's length (`length frames at frames per second`), and an action is
// shown while the frame is in [start, start + duration).
export const getCinemaLoopMilliseconds = (cinema: Cinema, milliseconds: number): number => {
  if (cinema.framesPerSecond === 0 || cinema.lengthFrames === 0) return 0
  const loopMilliseconds = (cinema.lengthFrames * MILLISECONDS_PER_SECOND) / cinema.framesPerSecond
  return milliseconds % loopMilliseconds
}

export const getCinemaFrame = (cinema: Cinema, milliseconds: number): number =>
  Math.floor(
    (getCinemaLoopMilliseconds(cinema, milliseconds) * cinema.framesPerSecond) /
      MILLISECONDS_PER_SECOND
  )

export const getActiveCinemaActions = (
  cinema: Cinema,
  milliseconds: number
): readonly CinemaAction[] => {
  const frame = getCinemaFrame(cinema, milliseconds)
  return cinema.actions.filter(
    (action) => action.startFrame <= frame && frame < action.startFrame + action.durationFrames
  )
}

export const getActiveCinemaDummies = (
  cinema: Cinema,
  milliseconds: number
): readonly CinemaDummy[] => {
  const frame = getCinemaFrame(cinema, milliseconds)
  return cinema.dummies.filter(
    (dummy) => dummy.startFrame <= frame && frame < dummy.startFrame + dummy.durationFrames
  )
}
