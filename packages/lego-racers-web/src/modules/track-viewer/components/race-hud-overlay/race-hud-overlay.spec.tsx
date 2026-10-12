import { render } from '@testing-library/react'
import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import RaceHudOverlay from './race-hud-overlay.tsx'
import type { RaceHudOverlayProps } from './race-hud-overlay.types.ts'

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

const getProps = (overrides: Partial<RaceHudOverlayProps> = {}): RaceHudOverlayProps => ({
  commands: [],
  imageUrls: new Map(),
  fonts: null,
  width: 800,
  height: 600,
  phase: 'racing',
  ...overrides,
})

describe('RaceHudOverlay', () => {
  it('renders default snapshot', () => {
    // Arrange / Act
    const { container } = render(<RaceHudOverlay {...getProps({ commands: [] })} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the countdown numeral as accessible text beside the font canvas', () => {
    // Arrange / Act
    const { container, getByText } = render(
      <RaceHudOverlay {...getProps({ commands: [text()], phase: 'countdown' })} />
    )

    // Assert
    expect(container).toMatchSnapshot()
    expect(getByText('3')).toBeInTheDocument()
  })

  it('renders the lap row texts with the font colour white', () => {
    // Arrange
    const commands = [
      text({ text: 'LAP', font: 'text', x: 400, y: 7, scaleX: 1, scaleY: 1, color: null }),
      text({ text: '1', font: 'text', x: 450, y: 7, scaleX: 1, scaleY: 1, color: null }),
    ]

    // Act
    const { container } = render(<RaceHudOverlay {...getProps({ commands })} />)

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
    const { container } = render(<RaceHudOverlay {...getProps({ commands, imageUrls })} />)

    // Assert
    expect(container).toMatchSnapshot()
    expect(container.querySelectorAll('img')).toHaveLength(2)
  })

  it('renders the pause menu: its dimmer is drawn on the canvas, its lines as accessible text', () => {
    // Arrange
    const commands: HudCommand[] = [
      { kind: 'fill', x: 0, y: 0, width: 800, height: 600, color: 0x40000000 },
      text({
        text: 'GAME PAUSED',
        font: 'text',
        x: 340,
        y: 245,
        scaleX: 1,
        scaleY: 1,
        color: null,
      }),
    ]

    // Act
    const { container, getByText } = render(<RaceHudOverlay {...getProps({ commands })} />)

    // Assert
    expect(container).toMatchSnapshot()
    expect(getByText('GAME PAUSED')).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })
})
