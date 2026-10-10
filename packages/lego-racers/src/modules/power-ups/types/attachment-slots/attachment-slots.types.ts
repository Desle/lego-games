import type { AttachmentSlots } from '../power-ups.types.ts'

export type AttachmentAllocation = {
  readonly slots: AttachmentSlots
  readonly slotIndex: number | null
}
