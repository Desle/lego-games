import { render } from '@testing-library/react'
import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import RaceHudOverlay from './race-hud-overlay.tsx'

const text = (overrides: Partial<Extract<HudCommand, { kind: 'text' }>> = {}): HudCommand => ({
  kind: 'text',
  text: '3',
  font: 'digits',
  x: 380,
  y: 250,
  scaleX: 1.8,
  scaleY: 1.8,
  color: 0xff00ffff,
  ...overrides,
})

describe('RaceHudOverlay', () => {
  it('renders default snapshot', () => {
    // Arrange / Act
    const { container } = render(
      <RaceHudOverlay commands={[]} imageUrls={new Map()} phase={null} />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the countdown numeral in cyan at its position and scale', () => {
    // Arrange / Act
    const { container, getByText } = render(
      <RaceHudOverlay commands={[text()]} imageUrls={new Map()} phase="countdown" />
    )

    // Assert
    expect(container).toMatchSnapshot()
    expect(getByText('3')).toHaveStyle({ left: '380px', top: '250px', color: 'rgb(0, 255, 255)' })
  })

  it('renders the lap row texts with the font colour white', () => {
    // Arrange
    const commands = [
      text({ text: 'LAP', font: 'text', x: 400, y: 7, scaleX: 1, scaleY: 1, color: null }),
      text({ text: '1', font: 'text', x: 450, y: 7, scaleX: 1, scaleY: 1, color: null }),
    ]

    // Act
    const { container } = render(
      <RaceHudOverlay commands={commands} imageUrls={new Map()} phase="racing" />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the held power-up holder and icon from the image database urls', () => {
    // Arrange
    const commands: HudCommand[] = [
      {
        kind: 'image',
        imageIndex: 11,
        imageName: 'HOLDER',
        x: 20,
        y: 500,
        width: 64,
        height: 64,
        color: null,
      },
      {
        kind: 'image',
        imageIndex: 2,
        imageName: 'CANNON',
        x: 36,
        y: 520,
        width: 32,
        height: 32,
        color: null,
      },
      {
        kind: 'image',
        imageIndex: 3,
        imageName: 'GRAPPLE',
        x: 0,
        y: 0,
        width: 8,
        height: 8,
        color: null,
      },
    ]
    const imageUrls = new Map([
      ['HOLDER', 'data:image/png;base64,AA=='],
      ['CANNON', 'data:image/png;base64,BB=='],
    ])

    // Act
    const { container } = render(
      <RaceHudOverlay commands={commands} imageUrls={imageUrls} phase="racing" />
    )

    // Assert
    expect(container).toMatchSnapshot()
    expect(container.querySelectorAll('img')).toHaveLength(2)
  })
})
