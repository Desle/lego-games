import type { TrackSession } from '../../../track-logic/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'

// Racer_Taunt 0x00439c90 sends this identifier as both the start and the stop of 0x00462580.
export const TAUNT_SIGNAL_IDENTIFIER = 999

// The signal 0x00439c90 sends to the event bus from the racer's display frame position.
export const sendTauntSignal = (
  session: Pick<TrackSession, 'startStopSignal'>,
  position: Vector3
): void =>
  session.startStopSignal(TAUNT_SIGNAL_IDENTIFIER, TAUNT_SIGNAL_IDENTIFIER, [
    position.x,
    position.y,
    position.z,
  ])
