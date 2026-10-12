import { useEffect, useMemo, useRef } from 'react'
// @check-allow layer-boundaries: the overlay paints with the same painter the pixel trace composites with, which only services may share with the harness
import { createBitmapFontPainter } from '../../services/bitmap-font-painter/bitmap-font-painter.ts'
// @check-allow layer-boundaries: the overlay paints with the same painter the pixel trace composites with, which only services may share with the harness
import { paintHud } from '../../services/hud-painter/hud-painter.ts'
import type { RaceHudOverlayProps } from './race-hud-overlay.types.ts'

// The race HUD as the HUD module laid it out: the text set in the game's bitmap fonts (glyph rectangles from the
// engine's font layout, drawn on a canvas) and the images at the positions and scales it gives, over the race view.
const RaceHudOverlay = ({
  commands,
  imageUrls,
  fonts,
  width,
  height,
  phase,
}: RaceHudOverlayProps) => {
  const canvasReference = useRef<HTMLCanvasElement | null>(null)
  const painter = useMemo(() => createBitmapFontPainter(), [])
  // The images the canvas draws parts and triangles of (the minimap), loaded once from their data URLs.
  const loadedImages = useMemo(
    () =>
      new Map(
        [...imageUrls].map(([name, url]) => {
          const image = new Image()
          image.src = url
          return [name, image] as const
        })
      ),
    [imageUrls]
  )
  useEffect(() => {
    const context = canvasReference.current?.getContext('2d') ?? null
    if (context === null) return
    if (fonts === null) {
      context.clearRect(0, 0, width, height)
      return
    }
    paintHud(context, {
      commands,
      fonts,
      loadedImages,
      painter,
      width,
      height,
      isImagePainted: false,
    })
  }, [commands, fonts, height, loadedImages, painter, width])
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="race-hud">
      <canvas
        ref={canvasReference}
        className="absolute inset-0"
        width={width}
        height={height}
        aria-hidden="true"
      />
      {commands.map((command, index) => {
        const key = `${String(index)}-${command.kind}`
        if (
          command.kind === 'fill' ||
          command.kind === 'image_part' ||
          command.kind === 'polygon'
        ) {
          return null
        }
        if (command.kind === 'text') {
          return (
            <span key={key} className="sr-only">
              {command.text}
            </span>
          )
        }
        const url = imageUrls.get(command.imageName.toUpperCase())
        return url === undefined ? null : (
          <img
            key={key}
            className="absolute max-w-none"
            alt={command.imageName}
            src={url}
            style={{
              left: command.x,
              top: command.y,
              width: command.width,
              height: command.height,
            }}
          />
        )
      })}
      {phase !== null && (
        <span className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-xs text-slate-200">
          {phase}
        </span>
      )}
    </div>
  )
}

export default RaceHudOverlay
