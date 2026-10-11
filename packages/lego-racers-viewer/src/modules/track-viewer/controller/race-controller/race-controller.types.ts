import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import type { LoadRaceOptions } from '@lego-games/lego-racers/race'
import type { RefObject } from 'react'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { HudFonts } from '../../types/hud-fonts/hud-fonts.types.ts'
import type { RaceStatus as RaceStatusValues } from '../../types/race-status/race-status.ts'

export type RaceStatus = EnumValues<typeof RaceStatusValues>

export type RaceScreen = {
  readonly status: RaceStatus
  readonly errorMessage: string | null
  // The race state the original calls its state: introduction, countdown, racing, finishing, results.
  readonly phase: string | null
  readonly hudCommands: readonly HudCommand[]
  readonly hudImageUrls: ReadonlyMap<string, string>
  readonly hudFonts: HudFonts | null
  readonly lapCount: number
}

export type RaceController = RaceScreen & {
  readonly containerReference: RefObject<HTMLDivElement | null>
  readonly isDevelopmentFilesAvailable: boolean
  // LEGO.JAM of the opened game while the menus show; null otherwise.
  readonly gameJam: Uint8Array | null
  readonly onDevelopmentGameRequested: () => void
  readonly onGameFilesChosen: (files: readonly File[]) => void
  // The menus chose a race: load it with these options and run it.
  readonly onRaceRequested: (options: LoadRaceOptions) => void
  // The menus were left (the quit question answered yes): back to the file choice.
  readonly onGameClosed: () => void
  // The race is stopped: back to the menus.
  readonly onRaceStopped: () => void
}
