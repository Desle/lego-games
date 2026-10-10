import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { ComputerRacerRouteLetter as ComputerRacerRouteLetterEnum } from './computer-racer-route-keyword/computer-racer-route-keyword.ts'

export type ComputerRacerRouteLetter = EnumValues<typeof ComputerRacerRouteLetterEnum>

export type Vector3 = readonly [number, number, number]
export type Quaternion = readonly [number, number, number, number]

// One 12-byte sample read by 0x004a5e10: two int16 then eight bytes (stored as their low 8 bits).
export type ComputerRacerRouteSample = {
  readonly first: number
  readonly second: number
  readonly bytes: readonly number[]
}

// The 0x48-byte route at race +0x3104 + 0x48 * racer; absent keywords keep the reset values of 0x004a50c0.
export type ComputerRacerRoute = {
  readonly firstVector: Vector3
  readonly firstQuaternion: Quaternion
  readonly secondVector: Vector3
  readonly secondQuaternion: Quaternion
  readonly firstInteger: number
  readonly sampleIndex: number
  readonly samples: readonly ComputerRacerRouteSample[]
  readonly readByteCount: number
}

export type ComputerRacerRouteVariantCounts = Readonly<Record<ComputerRacerRouteLetter, number>>

export type ComputerRacerRouteChoice = {
  readonly letter: ComputerRacerRouteLetter
  readonly variant: number
}
