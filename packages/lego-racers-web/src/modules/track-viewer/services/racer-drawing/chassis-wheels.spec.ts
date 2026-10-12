import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getBuiltRacerAppearance } from '@lego-games/lego-racers/racer-appearance'
import { loadChassisWheels } from './chassis-wheels.ts'

vi.mock('@lego-games/lego-racers/race', () => ({ readRacerDatabases: () => ({}) }))
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
