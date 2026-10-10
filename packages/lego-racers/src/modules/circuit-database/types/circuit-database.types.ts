// One `0x27 name { keywords }` block of LEGORACE.CRB (Circuits_Load 0x0041f1d0 → FUN_0041f030); the 100-byte
// record starts zeroed.
export type Circuit = {
  // The key the front end and the race catalog look the circuit up by.
  readonly name: string
  // Record +0x14 and +0x18.. (0x28, `[ count ] { name * count }`): the codes of the racers of the circuit, each a key
  // of the driver database. The front end copies them into the race's racer slots (0x0042d730).
  readonly racerCodes: readonly string[]
  // Record +0x60 (0x29): a 16-bit integer.
  readonly firstNumber: number
  // Record +0x58 (0x2a): an integer.
  readonly secondNumber: number
  // Record +0x0c (0x2b): a string of at most eight characters.
  readonly nextName: string
}

export type CircuitDatabase = {
  readonly circuits: readonly Circuit[]
  readonly readByteCount: number
}
