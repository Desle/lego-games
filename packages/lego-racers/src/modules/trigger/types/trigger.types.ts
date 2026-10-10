import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { TriggerFileKind as TriggerFileKindEnum } from './trigger-keyword/trigger-keyword.ts'

export type TriggerFileKind = EnumValues<typeof TriggerFileKindEnum>

export type Vector3 = readonly [number, number, number]

// One `0x27 { ... }` block; the four main-only fields stay false or null in an environment file.
export type Trigger = {
  readonly position: Vector3
  readonly radius: number
  readonly firstInteger: number
  // 0x004653f0 registers the trigger with 9 instead of 1 when set.
  readonly isFlag4Set: boolean
  // 0x004653f0 registers the trigger with 2 instead of 4 when set.
  readonly isFlag1000Set: boolean
  readonly objectName: string | null
  readonly secondInteger: number | null
}

export type TriggerList = {
  readonly triggers: readonly Trigger[]
  readonly readByteCount: number
}
