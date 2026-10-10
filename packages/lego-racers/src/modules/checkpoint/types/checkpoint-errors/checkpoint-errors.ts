// 0x0041e7f9 shows "Too many CheckPoints" and exits.
export class TooManyCheckpointsError extends Error {
  constructor(count: number) {
    super(`Too many CheckPoints (${String(count)})`)
    this.name = 'TooManyCheckpointsError'
  }
}

// The original dereferences an empty array or walks a branch forever here; the port refuses instead.
export class UnportableCheckpointsError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'UnportableCheckpointsError'
  }
}
