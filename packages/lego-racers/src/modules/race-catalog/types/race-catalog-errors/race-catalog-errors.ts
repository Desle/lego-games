// FUN_004364f0 0x004364f0 (string 0x004bef1c): a race names a circuit that LEGORACE.CRB does not hold; fatal.
export class UnknownCircuitError extends Error {
  readonly circuitName: string

  constructor(circuitName: string) {
    super(`Unable to find circuit ${circuitName}`)
    this.name = 'UnknownCircuitError'
    this.circuitName = circuitName
  }
}
