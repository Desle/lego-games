import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import type { HudFonts } from '../../types/hud-fonts/hud-fonts.types.ts'

export type RaceHudOverlayProps = {
  readonly commands: readonly HudCommand[]
  // Image database name (upper case) → data URL.
  readonly imageUrls: ReadonlyMap<string, string>
  // The HUD's bitmap fonts by HudFont value; null until a race is loaded.
  readonly fonts: HudFonts | null
  // The size of the stage the HUD was laid out for.
  readonly width: number
  readonly height: number
  // Canvas pixels per stage pixel (1 draws the stage as is).
  readonly pixelRatio: number
  // The race state, shown in a corner; null hides it.
  readonly phase: string | null
}
