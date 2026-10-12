import type { ActiveCinemaVertexEffect, CinemaEvents } from '../../types/cinema-events.types.ts'
import type { Cinema, CinemaAction, CinemaDummy, CinemaTiming } from '../../types/cinema.types.ts'

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

// An entry is on the timeline from its start frame for its duration (frames).
export const getIsOnTimeline = (entry: CinemaTiming, frame: number): boolean =>
  entry.startFrame <= frame && frame < entry.startFrame + entry.durationFrames

// The time an action has run, in milliseconds of the loop's clock: its animation starts with the action (hypothesis: the
// start of the entry is the start of the clip).
export const getCinemaActionMilliseconds = (
  cinema: Cinema,
  action: CinemaAction,
  milliseconds: number
): number =>
  Math.max(
    0,
    getCinemaLoopMilliseconds(cinema, milliseconds) -
      (action.startFrame * MILLISECONDS_PER_SECOND) / cinema.framesPerSecond
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

const START_LIST_KEYWORD = 0x56
const VERTEX_EFFECT_KEYWORD = 0x2b

// The vertex effects the dummies on the timeline start (`PST.CEB`: `MM_FLSH` starts `vtx1`), with the index of the dummy
// that starts each.
export const getActiveCinemaVertexEffects = (
  cinema: Cinema,
  events: CinemaEvents,
  milliseconds: number
): readonly ActiveCinemaVertexEffect[] => {
  const starts =
    events.reactionLists.find((list) => list.listKeyword === START_LIST_KEYWORD)?.starts ?? []
  return getActiveCinemaDummies(cinema, milliseconds).flatMap((dummy) =>
    starts
      .filter(
        (reaction) =>
          reaction.entryName.toLowerCase() === dummy.name.toLowerCase() &&
          reaction.targetKeyword === VERTEX_EFFECT_KEYWORD
      )
      .flatMap((reaction) => {
        const effect = events.vertexEffects.find(
          (candidate) => candidate.name.toLowerCase() === reaction.targetName.toLowerCase()
        )
        return effect === undefined
          ? []
          : [Object.freeze({ dummyIndex: cinema.dummies.indexOf(dummy), effect })]
      })
  )
}
