import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { ComputerRacerRoute } from '../../computer-racer-route/index.ts'
import type { RandomTablePosition } from '../../random-table/index.ts'
import type { Quaternion, Vector3 } from '../../simulation-math/index.ts'
import type { PowerUpUseDecision as PowerUpUseDecisionValues } from './power-up-use/power-up-use-decision.ts'

// One route sample decoded as 0x004a5ec0..0x004a5fc0 read it (sample +0..+11).
export type DecodedRouteSample = {
  // 0x004a5ef0: int16, int16 and int8 offsets from the previous sample, times 2^-8, 2^-8 and 2^-4.
  readonly offset: Vector3
  // 0x004a5f40: four int8 times float32 0x3c010204 (about 1/127); absolute, not relative.
  readonly rotation: Quaternion
  // 0x004a5fa0 / 0x004a5fc0: int8 bytes 9 and 10 times 0.125, the lateral room on each side.
  readonly negativeLateralLimit: number
  readonly positiveLateralLimit: number
  // 0x004a5ec0: byte 11 >> 6, with 3 read as 4.
  readonly contactState: number
  // 0x004a5ee0: (byte 11 & 0x3f) << 5 milliseconds from the previous sample.
  readonly durationMilliseconds: number
}

// The 0x78-byte route follower (car body +0x74c); offsets in comments.
export type RouteFollower = {
  readonly route: ComputerRacerRoute | null // +0x28
  readonly position: Vector3 // +0x00
  readonly rotation: Quaternion // +0x0c
  readonly contactState: number // +0x1c
  readonly negativeLateralLimit: number // +0x20
  readonly positiveLateralLimit: number // +0x24
  readonly speedFactor: number // +0x2c (car body +0x778)
  readonly time: number // +0x30, float32 milliseconds
  readonly previousSampleIndex: number // +0x34, -1 before the first advance
  readonly nextSampleIndex: number // +0x38
  readonly previousPosition: Vector3 // +0x3c
  readonly nextPosition: Vector3 // +0x48
  readonly previousRotation: Quaternion // +0x54
  readonly nextRotation: Quaternion // +0x64
  readonly previousTime: number // +0x74, integer milliseconds
}

// The car body fields the speed code of 0x00429d40 reads and writes.
export type ComputerSpeedState = {
  readonly flags: number // car body +0x6c0
  readonly speedFactor: number // +0x778
  readonly targetSpeedFactor: number // +0x7ec
  readonly defaultTargetSpeedFactor: number // +0x7e8
}

export type ComputerSpeedStepInput = {
  readonly state: ComputerSpeedState
  readonly contactState: number // car body +0x36c
  readonly stepMilliseconds: number // the sub-step as float32
}

// Car body +0x7c8 (height above the route) and +0x7d0 (its vertical speed).
export type ComputerBounce = {
  readonly flags: number
  readonly height: number
  readonly verticalSpeed: number
}

// Racer set +0x284: racers, count, countdown (15,000 ms at set-up) and bias (+0xc).
export type RubberBand = {
  readonly countdownMilliseconds: number
  readonly bias: number
}

export type RubberBandRacer = {
  readonly isComputer: boolean // racer +0xd08 == 2
  readonly isExempt: boolean // racer +0xd04 & 0x20100000
  readonly lap: number // racer +0xd18 (int32)
  readonly checkpointProgress: number | null // racer +0xcc4 → checkpoint +0x1c, null without one
  readonly speed: ComputerSpeedState
}

export type RubberBandStep = {
  readonly rubberBand: RubberBand
  readonly speeds: readonly ComputerSpeedState[]
}

// Racer +0xd1c..+0xd22, derived from the driver's six bytes (description +0x6c..+0x71).
export type ComputerPersonality = {
  readonly chances: readonly number[]
  readonly combinedChance: number
}

export type RacerConeQuery = {
  readonly racerPositions: readonly Vector3[]
  readonly origin: Vector3
  readonly direction: Vector3
  readonly minimumDistanceSquared: number
  readonly maximumDistanceSquared: number
  readonly minimumCosine: number
}

export type PowerUpUseDecisionValue = EnumValues<typeof PowerUpUseDecisionValues>

export type PowerUpUseInput = {
  readonly heldPowerUp: number // racer +0xccc, 0 = none, 1..4
  readonly preferredPowerUp: number // racer +0xcd0
  readonly preferredLevel: number // racer +0xcd4
  readonly powerUpLevel: number // racer +0xd58
  readonly personality: ComputerPersonality
  readonly activePowerUpCount: number // power-ups +0x187c
  readonly racerFlags: number // racer +0xd04
  readonly carBodyFlags: number // racer +0xaa8 (car body +0x6c0)
  readonly isTargetAhead: boolean // 0x0043ca60 (100, 62,500, 0.96) found a racer, for power-up 1
}

export type PowerUpUseResult = {
  readonly position: RandomTablePosition
  readonly decision: PowerUpUseDecisionValue
}

// Racer +0xcd8 (elapsed) and +0xcdc (interval) of the power-up check in 0x004377f0.
export type PowerUpUseSchedule = {
  readonly elapsedMilliseconds: number
  readonly intervalMilliseconds: number
}

export type PowerUpUseStep = {
  readonly position: RandomTablePosition
  readonly schedule: PowerUpUseSchedule
  readonly decision: PowerUpUseDecisionValue | null
}

// Racer +0xd34 (taunt check) and +0xd44 (voice cooldown), drawn in this order by 0x00436df0.
export type ComputerTimers = {
  readonly position: RandomTablePosition
  readonly tauntMilliseconds: number
  readonly voiceMilliseconds: number
}

export type ComputerTauntStep = {
  readonly position: RandomTablePosition
  readonly tauntMilliseconds: number
  readonly isTaunting: boolean
}

// The segment of a route between two samples that 0x004a5750 works on.
export type RouteSegment = {
  readonly previousSampleIndex: number
  readonly nextSampleIndex: number
  readonly previousTime: number
  readonly nextTime: number
  readonly previousPosition: Vector3
  readonly nextPosition: Vector3
}
