// One `0x27 name { keywords }` block of LEGORACE.RCB (RaceCatalog_Load 0x004366f0 → FUN_004364f0); the 0x38-byte
// record starts zeroed. The loader links the race into its circuit's table of races (circuit +0x48 + 4 · number).
export type RaceCatalogEntry = {
  // The key of the entry.
  readonly name: string
  // Record +0x28 (0x28): the race's number in its circuit; 0 to 3 fit the circuit's table.
  readonly raceNumber: number
  // Record +0x0c (0x29): a string of at most eight characters.
  readonly firstName: string
  // Record +0x24 (0x2a): the circuit; the loader looks it up and stops with "Unable to find circuit" otherwise.
  readonly circuitName: string
  // Record +0x34 (0x2b): a 16-bit integer.
  readonly shortNumber: number
  // Record +0x2c (0x2c): a keyword without a value that sets the flag to 1.
  readonly isFlagged: boolean
  // Record +0x14 (0x2d) and +0x1c (0x2e): strings of at most eight characters.
  readonly secondName: string
  readonly thirdName: string
}

export type RaceCatalog = {
  readonly entries: readonly RaceCatalogEntry[]
  readonly readByteCount: number
}
