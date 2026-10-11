import { HUD_FONT_FAMILY, HUD_FONT_SIZES } from '../../types/hud-fonts/hud-fonts.ts'
import type { RaceHudOverlayProps } from './race-hud-overlay.types.ts'

// 0xAARRGGBB as a CSS colour; null is the font's own white.
const getCssColor = (color: number | null): string =>
  color === null
    ? '#ffffff'
    : `rgb(${String((color >>> 16) & 0xff)} ${String((color >>> 8) & 0xff)} ${String(color & 0xff)})`

// The race HUD as the HUD module laid it out: text and images at the positions and scales it gives, over the
// race view. The HUD fonts are browser fonts (the game's bitmap fonts are not built yet).
const RaceHudOverlay = ({ commands, imageUrls, phase }: RaceHudOverlayProps) => (
  <div className="pointer-events-none absolute inset-0" data-testid="race-hud">
    {commands.map((command, index) => {
      const key = `${String(index)}-${command.kind}`
      if (command.kind === 'text') {
        return (
          <span
            key={key}
            className="absolute whitespace-pre leading-none"
            style={{
              left: command.x,
              top: command.y,
              transform: `scale(${String(command.scaleX)}, ${String(command.scaleY)})`,
              transformOrigin: '0 0',
              fontFamily: HUD_FONT_FAMILY,
              fontSize: HUD_FONT_SIZES[command.font],
              color: getCssColor(command.color),
              textShadow: '2px 2px 0 #000',
            }}
          >
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
          style={{ left: command.x, top: command.y, width: command.width, height: command.height }}
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

export default RaceHudOverlay
