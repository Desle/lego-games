import type { JamLookupFailure } from '../jam-archive.types.ts'

export class JamArchiveReadError extends Error {
  constructor() {
    super('Error reading JAM file.')
    this.name = 'JamArchiveReadError'
  }
}

export class JamLookupError extends Error {
  readonly failure: JamLookupFailure
  readonly path: string

  constructor(failure: JamLookupFailure, path: string) {
    super(`JAM lookup failed (${failure}): ${path}`)
    this.name = 'JamLookupError'
    this.failure = failure
    this.path = path
  }
}
