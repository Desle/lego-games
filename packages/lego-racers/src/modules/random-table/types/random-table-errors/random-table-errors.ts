// The executable is not a 32-bit PE image, or the address is not backed by file data.
export class PortableExecutableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PortableExecutableError'
  }
}

// The bytes at 0x004befec are not the random table (wrong executable or version).
export class InvalidRandomTableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidRandomTableError'
  }
}

// The original's DIV/IDIV by zero raises a divide error (#DE) and the game crashes; the port refuses.
export class RandomDivisorError extends Error {
  readonly divisor: number

  constructor(divisor: number) {
    super(`Random table remainder by ${String(divisor)}: the original raises a divide error`)
    this.name = 'RandomDivisorError'
    this.divisor = divisor
  }
}
