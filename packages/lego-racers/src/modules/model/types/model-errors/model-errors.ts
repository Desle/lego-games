// Input whose original outcome depends on uninitialised stack memory (GolDP.dll 0x10027650); the port refuses it.
export class UnportableModelError extends Error {
  readonly position: number

  constructor(reason: string, position: number) {
    super(`${reason} (at byte ${String(position)})`)
    this.name = 'UnportableModelError'
    this.position = position
  }
}
