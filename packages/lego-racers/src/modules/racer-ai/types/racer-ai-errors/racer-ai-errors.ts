// The original would read outside the route's sample array (undefined memory); the port refuses.
export class UnportableRouteError extends Error {
  readonly sampleIndex: number

  constructor(sampleIndex: number) {
    super(`Route sample ${String(sampleIndex)} is outside the route`)
    this.name = 'UnportableRouteError'
    this.sampleIndex = sampleIndex
  }
}
