import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import { createBitmapFontPainter } from '../bitmap-font-painter/bitmap-font-painter.ts'
import { paintHud } from './hud-painter.ts'
import type { HudPaintInput } from './hud-painter.types.ts'

const fill: HudCommand = { kind: 'fill', x: 1, y: 2, width: 3, height: 4, color: 0x80ff0000 }
const image: HudCommand = {
  kind: 'image',
  imageIndex: 10,
  imageName: 'HOLDER',
  x: 5,
  y: 6,
  width: 7,
  height: 8,
  color: null,
}

const getContext = () => {
  const calls = { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn() }
  const context = { ...calls, fillStyle: '', imageSmoothingEnabled: true }
  return { calls, context: context as unknown as CanvasRenderingContext2D }
}

const getInput = (overrides: Partial<HudPaintInput> = {}): HudPaintInput => ({
  commands: [fill, image],
  fonts: new Map(),
  loadedImages: new Map([['HOLDER', { complete: true } as unknown as HTMLImageElement]]),
  painter: createBitmapFontPainter(),
  width: 640,
  height: 480,
  isImagePainted: false,
  ...overrides,
})

describe('paintHud', () => {
  it('clears the canvas and fills the rectangles with their colour', () => {
    // Arrange
    const { calls, context } = getContext()

    // Act
    paintHud(context, getInput())

    // Assert
    expect(calls.clearRect).toHaveBeenCalledWith(0, 0, 640, 480)
    expect(calls.fillRect).toHaveBeenCalledWith(1, 2, 3, 4)
    expect(context.fillStyle).toBe('rgba(255, 0, 0, 0.5019607843137255)')
  })

  it('leaves the whole images to the page elements unless asked to paint them', () => {
    // Arrange
    const { calls, context } = getContext()

    // Act
    paintHud(context, getInput())

    // Assert
    expect(calls.drawImage).not.toHaveBeenCalled()
  })

  it('paints the whole images when asked to', () => {
    // Arrange
    const { calls, context } = getContext()
    const input = getInput({ isImagePainted: true })

    // Act
    paintHud(context, input)

    // Assert
    expect(calls.drawImage).toHaveBeenCalledWith(input.loadedImages.get('HOLDER'), 5, 6, 7, 8)
  })
})
