// One entry of a profile's best-time table (FUN_0042f310 writes it): the time in milliseconds, 0 when nobody has set one,
// and the name of the racer who did (14 UTF-16 characters in the file).
export type BestTime = {
  readonly milliseconds: number
  readonly holderName: string
}

// One of the five input configuration records of the profile (0x27 bytes: three bytes, then nine dwords). The
// reader at 0x00442a00 and the writer at 0x00442c20 agree on this layout; what the codes mean is in save-data.md.
export type InputConfiguration = {
  readonly kind: number
  readonly secondKind: number
  readonly deviceIndex: number
  readonly codes: readonly number[]
}

// The header of a save file (0x477 bytes of data after the signature, FUN_00442a00 / FUN_00442c20).
export type SaveProfile = {
  // Header data +0x05 (profile +0x24): bit n is set when circuit n (LEGORACE.CRB `secondNumber`) was won first;
  // bit 7 is set once all twelve champion ghosts are beaten.
  readonly trophyFlags: number
  // +0x06 (profile +0x25): bit n is set when circuit n is unlocked; the reader ORs bit 0 in (FUN_0042f1f0).
  readonly circuitUnlockFlags: number
  // +0x07 (profile +0x26), 16 bits: bit n is set when the champion ghost of race n (LEGORACE.RCB order, n < 12) is beaten.
  readonly ghostBeatenFlags: number
  // +0x09 + 0x40 · n: the best lap and the best race time of track n (13 tracks).
  readonly bestLapTimes: readonly BestTime[]
  readonly bestRaceTimes: readonly BestTime[]
  // +0x349 (profile +0x0c): the racer count option, 5 in DEFAULT.LRS (FUN_0042e1f0 copies it to the settings).
  readonly racerCountOption: number
  // +0x34a, 16 bytes (profile +0x0d): the 3D device identifier the player chose (a GUID).
  readonly graphicsDeviceIdentifier: readonly number[]
  // +0x35a..+0x360 (profile +0x1d..+0x23): seven option bytes; see save-data.md for the ones the front end reads.
  readonly optionBytes: readonly number[]
  // +0x361, +0x365 (profile +0x368, +0x36c): four bytes for each of the two local players.
  readonly playerControlBytes: readonly (readonly number[])[]
  // +0x369 + 0x27 · n (profile +0x370 + 0x28 · n): the five input configurations.
  readonly inputConfigurations: readonly InputConfiguration[]
  // +0x42c..+0x476: the original keeps these bytes as they were read and writes them back unchanged.
  readonly reservedBytes: readonly number[]
}

// A racer record: one saved player (0x22d bytes, FUN_0042b5c0 copies it between the list and the menus).
export type SaveRacer = {
  // +0x00, 14 UTF-16 characters.
  readonly name: string
  // +0x1c..+0x20 (record +0x30..+0x34): five bytes that FUN_0042b330 hands to the menus, the fifth without bit 7.
  readonly colorBytes: readonly number[]
  // +0x21, eight characters: the key of the car's chassis in CMB (dachas0 ...).
  readonly chassisName: string
  // +0x29..+0x22a: the car design the car builder loads (FUN_0049c7f0), kept as bytes.
  readonly designBytes: readonly number[]
  // +0x22b, 16 bits: two bits per circuit, the best place won there (0 none, 1 first, 2 second, 3 third).
  readonly circuitRanks: number
}

export type SaveFile = {
  readonly profile: SaveProfile
  readonly racers: readonly SaveRacer[]
}

// Where saves live. The original stores each slot as the file `Save\<slot>\LEGORac1` beside the game (two slots are
// used); a browser adapter keeps the same bytes in its own storage.
export type SaveStorage = {
  readonly readSlot: (slot: number) => Promise<Uint8Array | null>
  readonly writeSlot: (slot: number, bytes: Uint8Array) => Promise<void>
  readonly deleteSlot: (slot: number) => Promise<void>
}
