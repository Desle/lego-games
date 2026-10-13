import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { NearestRacerCandidate, NearestRacerSound } from './nearest-racer-sound.types.ts'

// 0x0043ae20: the nearest racer is heard within 200 units (0x004b0a20 squared into 0x004c67a8).
const HEARING_DISTANCE = 200
const SQUARED_HEARING_DISTANCE = HEARING_DISTANCE * HEARING_DISTANCE
// 0x7f7fffff at 0x0043c4b0
const FLOAT32_MAXIMUM = 3.4028234663852886e38 // 0x7f7fffff
const VELOCITY_SCALE = 2 // 0x004b0a1c
const PITCH_BASE = getFloatFromBits(0x3ecccccd) // 0x004b0a08, 0.4
const PITCH_AIRBORNE_SHARE = getFloatFromBits(0x3dcccccd) // 0x004b0a0c, 0.1
const SPEED_SCALE = getFloatFromBits(0x3e2e147b) // 0x004b0a10, 0.17
const AIRBORNE_PITCH = getFloatFromBits(0x3e4ccccd) // 0x004b02e0, 0.2
// the airborne test of 0x0043c1b0
const AIRBORNE_MILLISECONDS = 0x32

// RacerSet_Step 0x0043c1b0 (its end): the sound object made at the track's load (0x0043ccb0, sound 0x4f) plays at the
// racer nearest to the camera's racer while it is within the hearing distance, with a pitch that follows its speed like
// the engine's middle loop; out of range it stops. Null when no racer is near.
export const getNearestRacerSound = (
  listenerRacerIndex: number,
  candidates: readonly NearestRacerCandidate[]
): NearestRacerSound | null => {
  const listener = candidates.find((candidate) => candidate.racerIndex === listenerRacerIndex)
  if (listener === undefined) return null
  let nearest: NearestRacerCandidate | null = null
  let nearestDistance = FLOAT32_MAXIMUM
  for (const candidate of candidates) {
    if (candidate.racerIndex === listenerRacerIndex) continue
    const deltaX = listener.position.x - candidate.position.x
    const deltaY = listener.position.y - candidate.position.y
    const deltaZ = listener.position.z - candidate.position.z
    const distance = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
    if (distance < nearestDistance) {
      nearest = candidate
      nearestDistance = distance
    }
  }
  if (nearest === null || nearestDistance >= SQUARED_HEARING_DISTANCE) return null
  const scaled = Math.min(
    Math.max(
      (1 - PITCH_BASE - PITCH_AIRBORNE_SHARE) *
        (nearest.speed / SPEED_SCALE) *
        nearest.engineSoundValue +
        PITCH_BASE,
      0
    ),
    1
  )
  return Object.freeze({
    racerIndex: nearest.racerIndex,
    position: nearest.position,
    velocity: Object.freeze({
      x: nearest.velocity.x * VELOCITY_SCALE,
      y: nearest.velocity.y * VELOCITY_SCALE,
      z: nearest.velocity.z * VELOCITY_SCALE,
    }),
    pitch: nearest.airborneMilliseconds > AIRBORNE_MILLISECONDS ? scaled + AIRBORNE_PITCH : scaled,
  })
}
