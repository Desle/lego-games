import { createFloatArithmetic, RACE_FPU_PRECISION } from '@lego-games/lego-racers/simulation-math'
import { layoutText } from '@lego-games/lego-racers/font-rendering'
import { useEffect, useMemo, useRef } from 'react'
import { createBitmapFontPainter } from '../../services/bitmap-font-painter/bitmap-font-painter.ts'
import type { RaceHudOverlayProps } from './race-hud-overlay.types.ts'

// 0xAARRGGBB; null is the font's own white.
const WHITE = 0xffffffff
// The text has no line break width in the HUD: the layout never wraps.
const UNBOUNDED_WIDTH = 0x7fff
const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

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
  useEffect(() => {
    const context = canvasReference.current?.getContext('2d') ?? null
    if (context === null || fonts === null) return
    context.clearRect(0, 0, width, height)
    context.imageSmoothingEnabled = false
    for (const command of commands) {
      if (command.kind !== 'text') continue
      const hudFont = fonts.get(command.font)
      if (hudFont === undefined) continue
      const glyphs = layoutText({
        font: hudFont.font,
        text: Array.from(command.text, (letter) => letter.charCodeAt(0)),
        surface: { width, height },
        x: command.x,
        y: command.y,
        maximumWidth: UNBOUNDED_WIDTH,
        lineGap: 0,
        scale: { x: command.scaleX, y: command.scaleY },
        clip: null,
        alignment: 'left',
        arithmetic,
      })
      painter.drawGlyphs(context, hudFont.image, glyphs, command.color ?? WHITE)
    }
  }, [commands, fonts, height, painter, width])
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
