// 0x00442910 answers 0x11 when a block's checksum does not match, and 0x00442770 when the signature is not "LR".
export class SaveFileError extends Error {
  readonly code: number

  constructor(code: number) {
    super(`The racer save is damaged (error ${String(code)})`)
    this.name = 'SaveFileError'
    this.code = code
  }
}
