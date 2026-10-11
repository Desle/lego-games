import type { Vector3 } from '../../../event/index.ts'
import type {
  TrackLogicContext,
  TrackLogicState,
  TrackLogicStep,
  TrackSession,
  TrackWorld,
} from '../../types/track-logic.types.ts'
import { createTrackSession } from '../track-session/track-session.ts'

// A world that never animates: no scene object is known, no material animation plays, and every sound slot and
// emitter can be taken. Callers that simulate the world replace it.
export const STATIC_TRACK_WORLD: TrackWorld = Object.freeze({
  getObject: () => null,
  getIsAnimationPlaying: () => false,
  getIsSoundAvailable: () => true,
  getIsEmitterAvailable: () => true,
})

// Runs one operation on the track logic (a signal, a trigger, a frame's update) and returns the new state and the
// effects the operation asked for, in order.
export const runTrackLogic = (
  state: TrackLogicState,
  context: TrackLogicContext,
  run: (session: TrackSession) => void
): TrackLogicStep => {
  const { session, finish } = createTrackSession(state, context)
  run(session)
  return finish()
}

// Events_Update 0x00461cc0.
export const updateTrackEvents = (
  state: TrackLogicState,
  context: TrackLogicContext,
  milliseconds: number
): TrackLogicStep => runTrackLogic(state, context, (session) => session.updateEvents(milliseconds))

// The track logic's part of Race_Update 0x00435220, in its order: the worlds' animation (0x00416090), Triggers_Update
// (environment, then main), Emitters_Update (both pools), Events_Update, Hazards_Update, Timers_Update.
export const updateTrackLogicFrame = (
  state: TrackLogicState,
  context: TrackLogicContext,
  milliseconds: number,
  racerCount: number
): TrackLogicStep =>
  runTrackLogic(state, context, (session) => {
    session.advanceWorlds(milliseconds)
    session.updateTriggers(racerCount)
    session.updateEmitters(milliseconds)
    session.updateEvents(milliseconds)
    session.updateHazards(milliseconds)
    session.updateTimers(milliseconds)
  })

// 0x0048ae00, after the racers' sub-steps: the hazards that follow the cameras.
export const updateTrackHazardsAfterRacers = (
  state: TrackLogicState,
  context: TrackLogicContext,
  cameraPositions: readonly Vector3[]
): TrackLogicStep =>
  runTrackLogic(state, context, (session) => session.updateHazardsAfterRacers(cameraPositions))

// Pass 4 of every racer set sub-step: the registry's time list (0x0042fc10) runs the timers' callbacks.
export const tickTrackTimeEntries = (
  state: TrackLogicState,
  context: TrackLogicContext,
  milliseconds: number
): TrackLogicStep =>
  runTrackLogic(state, context, (session) => session.tickTimeEntries(milliseconds))
