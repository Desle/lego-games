import { fireEvent, render, screen } from '@testing-library/react'
import { RaceStatus } from '../../types/race-status/race-status.ts'
import RacePanel from './race-panel.tsx'
import type { RacePanelProps } from './race-panel.types.ts'

const getProps = (overrides: Partial<RacePanelProps> = {}): RacePanelProps => ({
  status: RaceStatus.IDLE,
  errorMessage: null,
  isDirectoryPickerAvailable: true,
  onGameFolderRequested: vi.fn(),
  onGameFilesChosen: vi.fn(),
  ...overrides,
})

describe('RacePanel', () => {
  it('renders default snapshot', () => {
    // Arrange / Act
    const { container } = render(<RacePanel {...getProps()} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the folder input where the browser has no directory picker', () => {
    // Arrange / Act
    const { container } = render(<RacePanel {...getProps({ isDirectoryPickerAvailable: false })} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('asks for the game folder when the folder button is clicked', () => {
    // Arrange
    const props = getProps()
    render(<RacePanel {...props} />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: /game folder/ }))

    // Assert
    expect(props.onGameFolderRequested).toHaveBeenCalledTimes(1)
  })

  it('renders the loading state with the buttons disabled', () => {
    // Arrange / Act
    const { container } = render(<RacePanel {...getProps({ status: RaceStatus.LOADING })} />)

    // Assert
    expect(container).toMatchSnapshot()
    expect(screen.getByRole('button', { name: /game folder/ })).toBeDisabled()
  })

  it('renders the failure message', () => {
    // Arrange / Act
    const { container } = render(
      <RacePanel {...getProps({ status: RaceStatus.FAILED, errorMessage: 'No LEGORacers.exe' })} />
    )

    // Assert
    expect(container).toMatchSnapshot()
    expect(screen.getByRole('alert')).toHaveTextContent('No LEGORacers.exe')
  })

  it('hands the chosen files to the controller', () => {
    // Arrange
    const props = getProps({ isDirectoryPickerAvailable: false })
    const { container } = render(<RacePanel {...props} />)
    const file = new File(['x'], 'LEGO.JAM')

    // Act
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    })

    // Assert
    expect(props.onGameFilesChosen).toHaveBeenCalledWith([file])
  })
})
