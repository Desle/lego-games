// "Unsupported color depth encountered" (GolDP.dll 0x1005cbf0, raised by 0x1002a5e0).
export class UnsupportedTargaDepthError extends Error {
  constructor(bitsPerPixel: number) {
    super(`Unsupported color depth encountered (${String(bitsPerPixel)} bits per pixel)`)
    this.name = 'UnsupportedTargaDepthError'
  }
}

// A file the loader would read past its end or decode with a conversion that depends on the display's surface
// format, which the port does not model.
export class InvalidTargaError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'InvalidTargaError'
  }
}
