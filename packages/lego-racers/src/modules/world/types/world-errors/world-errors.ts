// The original writes past one of its fixed per-entry arrays here; the port refuses instead.
export class WorldOverflowError extends Error {
  constructor(description: string, position: number) {
    super(`${description} (at byte ${String(position)})`)
    this.name = 'WorldOverflowError'
  }
}
