// One `0x27 name { keywords }` block of a DDB (Drivers_Load 0x004208f0); the 0x30-byte record starts zeroed, so a
// keyword the block omits leaves 0 or an empty name.
export type Driver = {
  // The block's name: the key every lookup uses (0x004119a0 compares eight characters).
  readonly name: string
  // Record +0x00 (0x33), a 16-bit value that StringTable_GetString turns into the driver's display name (0x00421090).
  readonly nameStringIdentifier: number
  // Record +0x02 (0x28): the material library 0x00420ef0 loads with the Gol root's slot 0x10.
  readonly materialLibraryName: string
  // Record +0x0a (0x29): the texture database it loads with slot 0x0c.
  readonly textureDatabaseName: string
  // Record +0x12 (0x2a): the model it loads with slot 0x14.
  readonly modelName: string
  // Record +0x1a (0x2b): the champion this driver is (the key in CCB).
  readonly championName: string
  // Record +0x22 and +0x23 (0x3a, two integers): racer +0xcd0 (1 to 4, else 0) and +0xcd4.
  readonly preferredPowerUpCode: number
  readonly preferredPowerUpLevel: number
  // Record +0x24..+0x29 (0x2c..0x31): the six personality bytes 0x00436df0 turns into racer +0xd1c..+0xd21.
  readonly personalityBytes: readonly number[]
  // Record +0x2a (0x34): the racer's voice number; racer +0xd40 = 12 · this + 0x44c.
  readonly voiceNumber: number
  // Record +0x2b..+0x2f (0x35..0x39): bytes the race does not read.
  readonly unreadBytes: readonly number[]
}

export type DriverDatabase = {
  readonly drivers: readonly Driver[]
  readonly readByteCount: number
}
