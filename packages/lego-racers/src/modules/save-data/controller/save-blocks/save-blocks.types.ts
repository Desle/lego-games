export type SaveBlockRead = {
  readonly data: Uint8Array
  // The file position after the last block read.
  readonly nextPosition: number
}
