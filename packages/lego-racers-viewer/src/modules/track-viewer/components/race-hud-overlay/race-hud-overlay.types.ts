import type { HudCommand } from '@lego-games/lego-racers/race-hud'

export type RaceHudOverlayProps = {
  readonly commands: readonly HudCommand[]
  // Image database name (upper case) → data URL.
  readonly imageUrls: ReadonlyMap<string, string>
  // The race state, shown in a corner; null hides it.
  readonly phase: string | null
}
