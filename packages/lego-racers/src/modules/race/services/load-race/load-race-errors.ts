// A race folder that LEGORACE.RCB does not list: the front end has no circuit, and so no racers, for it.
export class UnknownRaceError extends Error {
  readonly raceFolder: string

  constructor(raceFolder: string) {
    super(`LEGORACE.RCB lists no race ${raceFolder}`)
    this.name = 'UnknownRaceError'
    this.raceFolder = raceFolder
  }
}
