import { fireEvent, render, screen } from '@testing-library/react'
import { RaceStatus } from '../../types/race-status/race-status.ts'
import RacePanel from './race-panel.tsx'
import type { RacePanelProps } from './race-panel.types.ts'

const getProps = (overrides: Partial<RacePanelProps> = {}): RacePanelProps => ({
  status: RaceStatus.IDLE,
  errorMessage: null,
  isDevelopmentFilesAvailable: true,
  onDevelopmentGameRequested: vi.fn(),
  onGameFilesChosen: vi.fn(),
  onRaceStopped: vi.fn(),
  ...overrides,
})

describe('RacePanel', () => {
  it('renders default snapshot', () => {
    // Arrange / Act
    const { container } = render(<RacePanel {...getProps()} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders without the development button in a production build', () => {
    // Arrange / Act
    const { container } = render(
      <RacePanel {...getProps({ isDevelopmentFilesAvailable: false })} />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the loading state with the buttons disabled', () => {
    // Arrange / Act
    const { container } = render(<RacePanel {...getProps({ status: RaceStatus.LOADING })} />)

    // Assert
    expect(container).toMatchSnapshot()
    expect(screen.getByRole('button', { name: /development files/ })).toBeDisabled()
  })

  it('renders the menus state with the keys of the menus', () => {
    // Arrange / Act
    const { container } = render(<RacePanel {...getProps({ status: RaceStatus.MENU })} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders a running race with a stop button', () => {
    // Arrange / Act
    const { container } = render(<RacePanel {...getProps({ status: RaceStatus.RUNNING })} />)

    // Assert
    expect(container).toMatchSnapshot()
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

  it('hands the chosen files and the clicks to the controller', () => {
    // Arrange
    const props = getProps({ status: RaceStatus.RUNNING })
    const { container } = render(<RacePanel {...props} />)
    const file = new File(['x'], 'LEGO.JAM')

    // Act
    fireEvent.click(screen.getByRole('button', { name: /development files/ }))
    fireEvent.click(screen.getByRole('button', { name: /Stop the race/ }))
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    })

    // Assert
    expect(props.onDevelopmentGameRequested).toHaveBeenCalledTimes(1)
    expect(props.onRaceStopped).toHaveBeenCalledTimes(1)
    expect(props.onGameFilesChosen).toHaveBeenCalledWith([file])
  })
})
