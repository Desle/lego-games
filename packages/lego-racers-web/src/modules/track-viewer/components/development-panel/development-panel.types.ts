import type { DevelopmentToolActions } from '../../types/development-tools/development-tools.types.ts'

export type DevelopmentPanelProps = DevelopmentToolActions & {
  readonly isRaceRunning: boolean
  readonly onRaceStopped: () => void
}
