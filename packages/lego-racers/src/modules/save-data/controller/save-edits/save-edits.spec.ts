import type { SaveFile, SaveRacer } from '../../types/save-data.types.ts'
import { createDefaultProfile } from '../profile-updates/profile-updates.ts'
import {
  getProfileWithRaceOptions,
  getRacerName,
  getSaveWithAddedRacer,
  getSaveWithoutRacer,
  getSaveWithRacer,
  LAP_OPTION_BYTE_INDEX,
  MAXIMUM_SAVED_RACER_COUNT,
} from './save-edits.ts'

const getRacer = (name: string): SaveRacer => ({
  name,
  colorBytes: [1, 2, 3, 4, 5],
  chassisName: 'dachas0',
  designBytes: [0, 0],
  circuitRanks: 0,
})

const getSave = (names: readonly string[]): SaveFile => ({
  profile: createDefaultProfile(0),
  racers: names.map(getRacer),
})

describe('save edits', () => {
  it('replaces one racer and leaves the others', () => {
    // Arrange
    const save = getSave(['A', 'B'])

    // Act
    const edited = getSaveWithRacer(save, 1, getRacer('C'))

    // Assert
    expect(edited.racers.map((racer) => racer.name)).toEqual(['A', 'C'])
  })

  it('adds a racer at the end and refuses one beyond the room of the file (0x3e00)', () => {
    // Arrange
    const full = getSave(Array.from({ length: MAXIMUM_SAVED_RACER_COUNT }, () => 'X'))

    // Act
    const added = getSaveWithAddedRacer(getSave(['A']), getRacer('B'))
    const refused = getSaveWithAddedRacer(full, getRacer('Y'))

    // Assert
    expect(added.racers.map((racer) => racer.name)).toEqual(['A', 'B'])
    expect(refused).toBe(full)
  })

  it('deletes a racer but never the last one', () => {
    // Arrange
    const save = getSave(['A', 'B'])

    // Act
    const deleted = getSaveWithoutRacer(save, 0)
    const kept = getSaveWithoutRacer(deleted, 0)

    // Assert
    expect(deleted.racers.map((racer) => racer.name)).toEqual(['B'])
    expect(kept).toBe(deleted)
  })

  it('keeps the opponents and the laps in the profile', () => {
    // Arrange
    const profile = createDefaultProfile(0)

    // Act
    const edited = getProfileWithRaceOptions(profile, 3, 7)

    // Assert
    expect(edited.racerCountOption).toBe(3)
    expect(edited.optionBytes[LAP_OPTION_BYTE_INDEX]).toBe(7)
    expect(edited.optionBytes[5]).toBe(profile.optionBytes[5])
  })

  it('cuts a name to 14 characters', () => {
    // Arrange / Act
    const name = getRacerName('ABCDEFGHIJKLMNOPQRS')

    // Assert
    expect(name).toBe('ABCDEFGHIJKLMN')
  })
})
