// One object registered with the racer set's collision registry (0x0042fb50 and 0x004408b0; the entries are 0x2c
// bytes in the list at registry +0x48).
export type RegistryEntry = {
  // Opaque: whatever the caller needs to find the object again (an effect, an explosion, a brick).
  readonly id: number
  // +0x08: bit 0 keeps the entry after its maximum number of calls, bit 1 only calls every interval-th contact, bit 3
  // (0x8) skips computer racers, bit 4 (0x10) skips human racers.
  readonly flags: number
  // +0x0c, +0x10.
  readonly maximumCalls: number
  readonly interval: number
  // +0x1c: callbacks so far, +0x20: contacts since the last callback.
  readonly calls: number
  readonly ticks: number
  // +0x24.
  readonly isActive: boolean
  // The object's volume: extents along the sort axis (volume +0x14 and +0x18).
  readonly minimumExtent: number
  readonly maximumExtent: number
}

// A racer's entry in the registry's other list (+0x2c).
export type RegistryRacer = {
  readonly racer: number
  // Racer +0xd08 == 2.
  readonly isComputer: boolean
  readonly isActive: boolean
  readonly minimumExtent: number
  readonly maximumExtent: number
}

// The message the callback of 0x004408e0 receives.
export type RegistryContact = {
  readonly id: number
  readonly racer: number
  readonly flags: number
  readonly calls: number
  readonly ticks: number
}

export type RegistryResult = {
  readonly entries: readonly RegistryEntry[]
  readonly contacts: readonly RegistryContact[]
}

// 0x004408e0's outcome for one entry: the entry after the contact and, when the call is due, the message.
export type EntryContact = {
  readonly entry: RegistryEntry
  readonly contact: Omit<RegistryContact, 'racer'> | null
}
