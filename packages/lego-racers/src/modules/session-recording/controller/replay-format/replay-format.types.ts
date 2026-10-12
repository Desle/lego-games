// A frame is one JSON array: [milliseconds, key codes, gamepad ([axes, buttons]) or null, menu or null, grant or null].
export type FrameLine = readonly [
  number,
  readonly string[],
  readonly [readonly number[], readonly number[]] | null,
  readonly [boolean, number, boolean, boolean] | null,
  readonly [number, number] | null,
]
