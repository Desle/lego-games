import type { AttachmentSlots } from '../power-ups.types.ts'
import type { AttachmentAllocation } from './attachment-slots.types.ts'

// 0x19: the 0xf4-byte attachment objects at power-up system +0xa4 (constructed by 0x00457990).
export const ATTACHMENT_SLOT_COUNT = 25

export const EMPTY_ATTACHMENT_SLOTS: AttachmentSlots = Object.freeze({ usedMask: 0, usedCount: 0 })

// 0x0045b9e0: the lowest free slot, or null when all 25 are used.
export const allocateAttachmentSlot = (slots: AttachmentSlots): AttachmentAllocation => {
  if (slots.usedCount === ATTACHMENT_SLOT_COUNT) return Object.freeze({ slots, slotIndex: null })
  let slotIndex = 0
  while (((slots.usedMask >>> slotIndex) & 1) !== 0 && slotIndex < ATTACHMENT_SLOT_COUNT) {
    slotIndex += 1
  }
  return Object.freeze({
    slots: Object.freeze({
      usedMask: (slots.usedMask | (1 << slotIndex)) >>> 0,
      usedCount: slots.usedCount + 1,
    }),
    slotIndex,
  })
}

// 0x0045ba40.
export const freeAttachmentSlot = (slots: AttachmentSlots, slotIndex: number): AttachmentSlots =>
  Object.freeze({
    usedMask: (slots.usedMask & ~(1 << slotIndex)) >>> 0,
    usedCount: slots.usedCount - 1,
  })

// The checks before a shield (0x0045b030: at least 2 free) and a turbo, magnet or curse (at least 3 free).
export const getIsAttachmentRoomFor = (slots: AttachmentSlots, requiredFree: number): boolean =>
  ATTACHMENT_SLOT_COUNT - slots.usedCount >= requiredFree
