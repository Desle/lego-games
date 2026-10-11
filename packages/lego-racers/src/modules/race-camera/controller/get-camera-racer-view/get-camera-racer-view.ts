import type { Racer } from '../../../racer/index.ts'
import type { CameraRacerView } from '../../types/race-camera.types.ts'

// Car body flag 0x2 (+0x6c0), read at racer +0xaa8 by 0x00428540.
const BODY_FLAG_TWO = 0x2
// Driver flag 0x1, full throttle, at racer +0xc84.
const DRIVER_FULL_THROTTLE = 0x1

// What Camera_Update reads from a racer: its display frame (racer +0x5c), the car body's forward speed (+0x618),
// turn radius (+0x64c) and flags (+0x6c0), the driver's flags (racer +0xc84) and the turbo level (racer +0xd68),
// which the racer module does not keep, so the caller tracks it from the power-up events.
export const getCameraRacerView = (racer: Racer, turboLevel: number): CameraRacerView => {
  const { displayFrame, forwardSpeed, turnRadius, flags } = racer.carBody.rigidBody
  return Object.freeze({
    position: displayFrame.position,
    rotation: displayFrame.rotation,
    turnRadius,
    forwardSpeed,
    isBodyFlagTwoSet: (flags & BODY_FLAG_TWO) !== 0,
    isFullThrottle: (racer.driver.flags & DRIVER_FULL_THROTTLE) !== 0,
    turboLevel,
  })
}
