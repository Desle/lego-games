import { fireEvent, render, screen } from '@testing-library/react'
import AnimationControl from './animation-control.tsx'

describe('AnimationControl', () => {
  it('renders default snapshot', () => {
    // Arrange
    const onPlayingToggled = vi.fn()

    // Act
    const { container } = render(
      <AnimationControl
        isPlaying
        animatedInstanceCount={3}
        isSkyShown
        onPlayingToggled={onPlayingToggled}
      />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders paused, with one instance and no sky', () => {
    // Arrange
    const onPlayingToggled = vi.fn()

    // Act
    const { container } = render(
      <AnimationControl
        isPlaying={false}
        animatedInstanceCount={1}
        isSkyShown={false}
        onPlayingToggled={onPlayingToggled}
      />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('asks to toggle when the button is pressed', () => {
    // Arrange
    const onPlayingToggled = vi.fn()
    render(
      <AnimationControl
        isPlaying
        animatedInstanceCount={0}
        isSkyShown={false}
        onPlayingToggled={onPlayingToggled}
      />
    )

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }))

    // Assert
    expect(onPlayingToggled).toHaveBeenCalledTimes(1)
  })
})
