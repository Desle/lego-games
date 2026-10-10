import type {
  EntryContact,
  RegistryContact,
  RegistryEntry,
  RegistryRacer,
  RegistryResult,
} from './collision-registry.types.ts'

const KEEPS_AFTER_MAXIMUM_CALLS_FLAG = 0x1
const CALLS_EVERY_INTERVAL_FLAG = 0x2
const SKIPS_COMPUTERS_FLAG = 0x8
const SKIPS_HUMANS_FLAG = 0x10

// 0x0043d200 and 0x0043d3f0: inactive entries leave the list, and the rest is insertion-sorted (stable) by the minimum
// extent of its volume.
export const getSortedRegistryEntries = (
  entries: readonly RegistryEntry[]
): readonly RegistryEntry[] =>
  Object.freeze(
    entries
      .filter((entry) => entry.isActive)
      .map((entry, position) => ({ entry, position }))
      .sort(
        (left, right) =>
          (left.entry.minimumExtent < right.entry.minimumExtent
            ? -1
            : left.entry.minimumExtent > right.entry.minimumExtent
              ? 1
              : 0) || left.position - right.position
      )
      .map(({ entry }) => entry)
  )

// 0x004408e0 (thiscall on the entry; racer message): counts the contact and, when it is due, the call. The entry stays
// active unless it has used its maximum number of calls and does not keep going (flag 1).
const getEntryAfterContact = (entry: RegistryEntry): EntryContact => {
  const ticks = entry.ticks + 1
  if ((entry.flags & CALLS_EVERY_INTERVAL_FLAG) !== 0 && ticks < entry.interval) {
    return { entry: Object.freeze({ ...entry, ticks }), contact: null }
  }
  const calls = entry.calls + 1
  const isActive =
    (entry.flags & KEEPS_AFTER_MAXIMUM_CALLS_FLAG) !== 0 || entry.maximumCalls > calls
  return {
    entry: Object.freeze({
      ...entry,
      ticks: (entry.flags & CALLS_EVERY_INTERVAL_FLAG) !== 0 ? 0 : ticks,
      calls,
      isActive,
    }),
    contact: { id: entry.id, flags: entry.flags, calls, ticks },
  }
}

const getIsEntryForRacer = (entry: RegistryEntry, racer: RegistryRacer): boolean =>
  !((entry.flags & SKIPS_COMPUTERS_FLAG) !== 0 && racer.isComputer) &&
  !((entry.flags & SKIPS_HUMANS_FLAG) !== 0 && !racer.isComputer)

// 0x0043d270: for each racer, the entries are walked from the first whose maximum extent reaches the racer's minimum
// extent, until one starts beyond the racer's maximum extent; each entry whose volume the racer touches gets its
// callback. getIsTouching is the racer volume's slot 6 (+0x18), the precise volume test.
export const getRegistryContacts = (
  entries: readonly RegistryEntry[],
  racers: readonly RegistryRacer[],
  getIsTouching: (racer: number, entry: RegistryEntry) => boolean
): RegistryResult => {
  let current = entries
  const contacts: RegistryContact[] = []
  for (const racer of racers) {
    if (!racer.isActive) continue
    const first = current.findIndex(
      (entry) => entry.isActive && racer.minimumExtent <= entry.maximumExtent
    )
    if (first === -1) continue
    for (let index = first; index < current.length; index += 1) {
      const entry = current[index]
      if (entry === undefined || !entry.isActive || !getIsEntryForRacer(entry, racer)) continue
      if (racer.maximumExtent < entry.minimumExtent) break
      if (!getIsTouching(racer.racer, entry)) continue
      const touched = getEntryAfterContact(entry)
      current = current.map((candidate, candidateIndex) =>
        candidateIndex === index ? touched.entry : candidate
      )
      if (touched.contact !== null) contacts.push({ ...touched.contact, racer: racer.racer })
    }
  }
  return Object.freeze({ entries: Object.freeze(current), contacts: Object.freeze(contacts) })
}
