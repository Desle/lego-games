export class InvalidBitmapError extends Error {
  constructor(reason = 'Invalid BMP file') {
    super(reason)
    this.name = 'InvalidBitmapError'
  }
}
