import type { RaceStatus } from '../../controller/race-controller/race-controller.types.ts'

export type RacePanelProps = {
  readonly status: RaceStatus
  readonly errorMessage: string | null
  readonly isDirectoryPickerAvailable: boolean
  readonly onGameFolderRequested: () => void
  readonly onGameFilesChosen: (files: readonly File[]) => void
}
