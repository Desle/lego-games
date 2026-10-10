// The original copies the samples into a fixed buffer without a check; the port refuses instead.
export class TooManyGhostSamplesError extends Error {
  constructor(count: number) {
    super(`A ghost of ${String(count)} samples overflows the original's sample buffer`)
    this.name = 'TooManyGhostSamplesError'
  }
}
