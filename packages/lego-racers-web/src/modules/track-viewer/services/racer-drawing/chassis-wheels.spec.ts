import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getBuiltRacerAppearance } from '@lego-games/lego-racers/racer-appearance'
import { loadChampionWheels, loadChassisWheels } from './chassis-wheels.ts'

vi.mock('@lego-games/lego-racers/race', () => ({
  readRacerDatabases: () => ({
    champions: { champions: [{ modelName: 'crcm', chassisName: 'crchas0' }] },
  }),
}))
vi.mock('@lego-games/lego-racers/scene', () => ({ loadModelScene: () => ({}) }))
vi.mock('@lego-games/lego-racers/racer-appearance', () => ({
  getRacerModelFiles: () => [],
  getBuiltRacerAppearance: vi.fn(() => ({ wheelModel: { modelName: 'ddjmw' } })),
}))

describe('loadChassisWheels', () => {
  it('asks the chassis database, which names its records in lower case, for a piece named in upper case', () => {
    // Arrange
    const archive = { readFile: () => new Uint8Array() } as unknown as JamArchive

    // Act
    loadChassisWheels(archive, 'DDCHAS0')

    // Assert
    expect(vi.mocked(getBuiltRacerAppearance).mock.calls[0]?.[1]).toBe('ddchas0')
  })
})

describe('loadChampionWheels', () => {
  it("finds the champion by his car's body code and takes the wheels of his chassis", () => {
    // Arrange
    const archive = { readFile: () => new Uint8Array() } as unknown as JamArchive

    // Act
    const wheels = loadChampionWheels(archive, 'CRCM')
    const unknown = loadChampionWheels(archive, 'XXCM')

    // Assert
    expect([wheels?.modelName, unknown]).toEqual(['ddjmw', null])
  })
})
