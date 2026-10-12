import type { WorldGroup } from '../../types/track-viewer.types.ts'

export type WorldListProps = {
  readonly worldGroups: readonly WorldGroup[]
  readonly selectedEntryId: string | null
  readonly isDisabled: boolean
  readonly onWorldEntrySelected: (entryId: string) => void
}
