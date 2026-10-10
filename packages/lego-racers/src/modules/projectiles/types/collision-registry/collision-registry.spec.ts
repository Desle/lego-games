import { getRegistryContacts, getSortedRegistryEntries } from './collision-registry.ts'
import type { RegistryEntry, RegistryRacer } from './collision-registry.types.ts'

const getEntry = (
  id: number,
  minimum: number,
  overrides: Partial<RegistryEntry> = {}
): RegistryEntry => ({
  id,
  flags: 1,
  maximumCalls: 0,
  interval: 0,
  calls: 0,
  ticks: 0,
  isActive: true,
  minimumExtent: minimum,
  maximumExtent: minimum + 10,
  ...overrides,
})

const getRacer = (
  racer: number,
  minimum: number,
  overrides: Partial<RegistryRacer> = {}
): RegistryRacer => ({
  racer,
  isComputer: false,
  isActive: true,
  minimumExtent: minimum,
  maximumExtent: minimum + 4,
  ...overrides,
})

const ALWAYS = (): boolean => true

describe('getSortedRegistryEntries (0x0043d200, 0x0043d3f0)', () => {
  it('drops inactive entries and sorts the rest by minimum extent, keeping the order of equal ones', () => {
    // Arrange
    const entries = [
      getEntry(1, 30),
      getEntry(2, 10),
      getEntry(3, 30, { isActive: false }),
      getEntry(4, 10),
    ]

    // Act
    const sorted = getSortedRegistryEntries(entries)

    // Assert
    expect(sorted.map((entry) => entry.id)).toEqual([2, 4, 1])
  })
})

describe('getRegistryContacts (0x0043d270)', () => {
  it('calls every touched entry whose extents overlap the racer, in list order', () => {
    // Arrange: the racer spans 12..16; entries span 0..10, 10..20, 14..24, 30..40.
    const entries = [getEntry(1, 0), getEntry(2, 10), getEntry(3, 14), getEntry(4, 30)]

    // Act
    const result = getRegistryContacts(entries, [getRacer(7, 12)], ALWAYS)

    // Assert: entry 1 ends before the racer; entry 4 starts after it.
    expect(result.contacts.map((contact) => [contact.id, contact.racer])).toEqual([
      [2, 7],
      [3, 7],
    ])
  })

  it('asks the precise volume test and skips entries it refuses', () => {
    // Arrange
    const entries = [getEntry(1, 10), getEntry(2, 10)]

    // Act
    const result = getRegistryContacts(
      entries,
      [getRacer(0, 10)],
      (_racer, entry) => entry.id === 2
    )

    // Assert
    expect(result.contacts.map((contact) => contact.id)).toEqual([2])
  })

  it('skips computers for flag 0x8 and humans for flag 0x10', () => {
    // Arrange
    const entries = [getEntry(1, 10, { flags: 0x9 }), getEntry(2, 10, { flags: 0x11 })]
    const racers = [getRacer(0, 10), getRacer(1, 10, { isComputer: true })]

    // Act
    const result = getRegistryContacts(entries, racers, ALWAYS)

    // Assert: the human touches entry 1; the computer touches entry 2.
    expect(result.contacts.map((contact) => [contact.id, contact.racer])).toEqual([
      [1, 0],
      [2, 1],
    ])
  })

  it('counts calls and deactivates an entry that used its maximum without flag 1', () => {
    // Arrange
    const entries = [getEntry(1, 10, { flags: 0, maximumCalls: 1 })]

    // Act
    const result = getRegistryContacts(entries, [getRacer(0, 10), getRacer(1, 10)], ALWAYS)

    // Assert: the second racer finds the entry gone.
    expect(result.contacts.map((contact) => contact.racer)).toEqual([0])
    expect(result.entries[0]).toMatchObject({ calls: 1, isActive: false })
  })

  it('calls only every interval-th contact with flag 0x2', () => {
    // Arrange
    const entries = [getEntry(1, 10, { flags: 0x3, interval: 3 })]
    const racers = [getRacer(0, 10), getRacer(1, 10), getRacer(2, 10), getRacer(3, 10)]

    // Act
    const result = getRegistryContacts(entries, racers, ALWAYS)

    // Assert: contacts 1 and 2 are counted, the third calls and resets, the fourth counts again.
    expect(result.contacts.map((contact) => contact.racer)).toEqual([2])
    expect(result.entries[0]).toMatchObject({ calls: 1, ticks: 1 })
  })

  it('ignores inactive racers', () => {
    // Arrange / Act
    const result = getRegistryContacts(
      [getEntry(1, 10)],
      [getRacer(0, 10, { isActive: false })],
      ALWAYS
    )

    // Assert
    expect(result.contacts).toEqual([])
  })
})
