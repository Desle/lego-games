// A sky the original would crash on: no settings, or a setting without keyframes (0x0041ce60 divides by the count).
export class SkyStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkyStateError'
  }
}
