import type { MaterialAnimation } from '../../types/material-animation.types.ts'

// LEGORacers.exe 0x00410560 and 0x004104c0: the row of an entry's table that whole elapsed frames select. The
// frames wrap at the entry's length (unsigned); the rows `first` to `first + count - 1` are searched from the last
// down for one whose time has started, and the last row answers when none has.
export const getMaterialAnimationRow = (
  animation: MaterialAnimation,
  entryIndex: number,
  elapsedFrames: number
): number => {
  const entry = animation.entries[entryIndex]
  if (entry === undefined) return 0
  const [first, count] = entry.keyword27Values
  const phase = (elapsedFrames >>> 0) % entry.keyword29Value
  const last = first + count - 1
  for (let index = last; index >= first; index -= 1) {
    if ((animation.materials[index]?.value ?? 0) <= phase) return index
  }
  return last
}
