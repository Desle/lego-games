import type { BuilderPreview } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { Group, Scene } from 'three'
import type { ModelObject } from '../model-object/model-object.types.ts'
import { createBuilderCarView } from './builder-car-view.ts'

const model: ModelObject = { group: new Group(), object: {} as ModelObject['object'] }

vi.mock('@lego-games/lego-racers/racer-appearance', () => ({ loadBuiltCarScene: () => ({}) }))
vi.mock('../model-object/model-object.ts', () => ({ createModelObject: () => model }))
vi.mock('../car-design-key/car-design-key.ts', () => ({ getCarDesignKey: () => 'design' }))
vi.mock('../racer-drawing/chassis-wheels.ts', () => ({
  getDesignChassisName: () => 'DDCHAS0',
  loadChassisWheels: () => {
    throw new Error('The chassis database has no record')
  },
}))

describe('createBuilderCarView', () => {
  it('shows the original car and warns when the wheels of its chassis cannot be read', () => {
    // Arrange
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const view = createBuilderCarView({} as JamArchive, new Scene())

    // Act
    view.show({ design: {} } as unknown as BuilderPreview)

    // Assert
    expect([warning.mock.calls.length, warning.mock.calls[0]?.[0]]).toEqual([
      1,
      expect.stringContaining('DDCHAS0'),
    ])
    warning.mockRestore()
  })
})
