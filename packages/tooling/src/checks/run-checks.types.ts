import type { Check, Violation } from './check.types.ts'

export type CheckOutcome = {
  readonly check: Check
  readonly violations: readonly Violation[]
}
