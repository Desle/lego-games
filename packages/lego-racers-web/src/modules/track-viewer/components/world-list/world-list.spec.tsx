import { fireEvent, render } from '@testing-library/react'
import WorldList from './world-list.tsx'

const WORLD_GROUPS = [
  {
    directory: 'GAMEDATA\\RACEC0R0',
    entries: [
      {
        id: 'race:GAMEDATA\\RACEC0R0',
        label: 'Whole race',
        worldPaths: ['GAMEDATA\\COMMON\\GLOBAL.WDB', 'GAMEDATA\\RACEC0R0\\RRTRK.WDB'],
        skyPath: 'GAMEDATA\\RACEC0R0\\BACKGRND.SKB',
        backgroundWorldPath: 'GAMEDATA\\RACEC0R0\\BACKGRD.WDB',
      },
      {
        id: 'GAMEDATA\\RACEC0R0\\RRTRK.WDB',
        label: 'RRTRK.WDB (after 1 race world)',
        worldPaths: ['GAMEDATA\\COMMON\\GLOBAL.WDB', 'GAMEDATA\\RACEC0R0\\RRTRK.WDB'],
        skyPath: null,
        backgroundWorldPath: null,
      },
    ],
  },
]

describe('WorldList', () => {
  it('renders default snapshot', () => {
    // Arrange
    const onWorldEntrySelected = vi.fn()

    // Act
    const { container } = render(
      <WorldList
        worldGroups={WORLD_GROUPS}
        selectedEntryId={null}
        isDisabled={false}
        onWorldEntrySelected={onWorldEntrySelected}
      />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the selected and disabled states', () => {
    // Arrange
    const selectedEntryId = 'GAMEDATA\\RACEC0R0\\RRTRK.WDB'

    // Act
    const { container } = render(
      <WorldList
        worldGroups={WORLD_GROUPS}
        selectedEntryId={selectedEntryId}
        isDisabled={true}
        onWorldEntrySelected={vi.fn()}
      />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('selects an entry by its id', () => {
    // Arrange
    const onWorldEntrySelected = vi.fn()
    const { getByText } = render(
      <WorldList
        worldGroups={WORLD_GROUPS}
        selectedEntryId={null}
        isDisabled={false}
        onWorldEntrySelected={onWorldEntrySelected}
      />
    )

    // Act
    fireEvent.click(getByText('Whole race'))

    // Assert
    expect(onWorldEntrySelected).toHaveBeenCalledWith('race:GAMEDATA\\RACEC0R0')
  })
})
