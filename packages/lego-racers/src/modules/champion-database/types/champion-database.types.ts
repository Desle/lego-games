import type { FloatTriple } from '../../token-reader/index.ts'

// One `0x27 name { keywords }` block of a CCB (Champions_Load 0x0041d370); the 0x30-byte record starts zeroed.
export type Champion = {
  // The key a driver's champion name looks up.
  readonly name: string
  // Record +0x00 (0x28): the material library 0x0041d7a0 loads with the Gol root's slot 0x10.
  readonly materialLibraryName: string
  // Record +0x08 (0x29): the texture database (slot 0x0c).
  readonly textureDatabaseName: string
  // Record +0x10 (0x2a): the model (slot 0x14).
  readonly modelName: string
  // Record +0x18 (0x2b): the chassis (CMB record) this champion drives.
  readonly chassisName: string
  // Record +0x20 (0x2c): 0x0043b480 stores it as the description's +0x58, the rigid body's mass.
  readonly mass: number
  // Record +0x24, +0x28, +0x2c (0x2d, three floats): description +0x4c, the car's local centre of mass.
  readonly centreOfMass: FloatTriple
}

export type ChampionDatabase = {
  readonly champions: readonly Champion[]
  readonly readByteCount: number
}
