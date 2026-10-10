import {
  allocateAttachmentSlot,
  ATTACHMENT_SLOT_COUNT,
  EMPTY_ATTACHMENT_SLOTS,
  freeAttachmentSlot,
  getIsAttachmentRoomFor,
} from './attachment-slots.ts'

describe('allocateAttachmentSlot', () => {
  it('takes the lowest free slot and reuses freed ones (0x0045b9e0, 0x0045ba40)', () => {
    // Arrange
    const first = allocateAttachmentSlot(EMPTY_ATTACHMENT_SLOTS)
    const second = allocateAttachmentSlot(first.slots)
    const freed = freeAttachmentSlot(second.slots, 0)

    // Act
    const third = allocateAttachmentSlot(freed)

    // Assert
    expect([first.slotIndex, second.slotIndex, third.slotIndex]).toEqual([0, 1, 0])
    expect(third.slots).toEqual({ usedMask: 3, usedCount: 2 })
  })

  it('fails when all 25 are used', () => {
    // Arrange
    const full = { usedMask: 0x1ffffff, usedCount: ATTACHMENT_SLOT_COUNT }

    // Act
    const allocation = allocateAttachmentSlot(full)

    // Assert
    expect(allocation.slotIndex).toBeNull()
  })
})

describe('getIsAttachmentRoomFor', () => {
  it('compares 25 minus the used count with the requirement', () => {
    // Arrange
    const slots = { usedMask: 0, usedCount: 23 }

    // Act
    const results = [getIsAttachmentRoomFor(slots, 2), getIsAttachmentRoomFor(slots, 3)]

    // Assert
    expect(results).toEqual([true, false])
  })
})
