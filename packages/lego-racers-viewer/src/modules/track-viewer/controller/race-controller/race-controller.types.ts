import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import type { RefObject } from 'react'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { RaceStatus as RaceStatusValues } from '../../types/race-status/race-status.ts'

export type RaceStatus = EnumValues<typeof RaceStatusValues>

export type RaceScreen = {
  readonly status: RaceStatus
  readonly errorMessage: string | null
  // The race state the original calls its state: introduction, countdown, racing, finishing, results.
  readonly phase: string | null
  readonly hudCommands: readonly HudCommand[]
  readonly hudImageUrls: ReadonlyMap<string, string>
  readonly lapCount: number
}

export type RaceController = RaceScreen & {
  readonly containerReference: RefObject<HTMLDivElement | null>
  readonly isDevelopmentFilesAvailable: boolean
  readonly onDevelopmentRaceRequested: () => void
  readonly onGameFilesChosen: (files: readonly File[]) => void
  readonly onRaceStopped: () => void
}
