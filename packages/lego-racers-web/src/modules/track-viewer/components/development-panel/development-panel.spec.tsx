import { fireEvent, render, screen } from '@testing-library/react'
import DevelopmentPanel from './development-panel.tsx'
import type { DevelopmentPanelProps } from './development-panel.types.ts'

const getProps = (overrides: Partial<DevelopmentPanelProps> = {}): DevelopmentPanelProps => ({
  isRaceRunning: false,
  onTrackViewerOpened: vi.fn(),
  onRaceStopped: vi.fn(),
  onRecordingDownloaded: vi.fn(),
  onEverythingUnlocked: vi.fn(),
  onOverlayClosed: vi.fn(),
  ...overrides,
})

describe('DevelopmentPanel', () => {
  it('renders default snapshot', () => {
    // Arrange / Act
    const { container } = render(<DevelopmentPanel {...getProps()} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the stop button while a race runs', () => {
    // Arrange / Act
    const { container } = render(<DevelopmentPanel {...getProps({ isRaceRunning: true })} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('hands the clicks to the controller', () => {
    // Arrange
    const props = getProps({ isRaceRunning: true })
    render(<DevelopmentPanel {...props} />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Track viewer' }))
    fireEvent.click(screen.getByRole('button', { name: /Stop the race/ }))
    fireEvent.click(screen.getByRole('button', { name: /Download the last session recording/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    // Assert
    expect(props.onTrackViewerOpened).toHaveBeenCalledTimes(1)
    expect(props.onRaceStopped).toHaveBeenCalledTimes(1)
    expect(props.onRecordingDownloaded).toHaveBeenCalledTimes(1)
    expect(props.onOverlayClosed).toHaveBeenCalledTimes(1)
  })
})
