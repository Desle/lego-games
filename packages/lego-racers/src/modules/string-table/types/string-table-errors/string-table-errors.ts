// 0x0044e2c0 returns 0 when a read comes back short; the port throws instead.
export class TruncatedStringTableError extends Error {
  constructor(expectedByteCount: number, byteLength: number) {
    super(`String table needs ${String(expectedByteCount)} bytes but has ${String(byteLength)}`)
    this.name = 'TruncatedStringTableError'
  }
}

// The original reads outside its buffers here; the port refuses instead of guessing.
export class StringTableOverreadError extends Error {
  constructor(index: number) {
    super(`String ${String(index)} reads outside the string table`)
    this.name = 'StringTableOverreadError'
  }
}
