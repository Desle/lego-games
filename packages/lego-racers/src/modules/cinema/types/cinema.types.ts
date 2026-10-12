import type { FloatTriple } from '../../token-reader/index.ts'

// Every entry of a cinema is on its timeline from `startFrame` for `durationFrames` frames (entry +0x0c, +0x10 = end).
export type CinemaTiming = {
  readonly name: string
  readonly startFrame: number
  readonly durationFrames: number
}

// A `0x29` entry: the world camera the cinema looks through (`target`: a camera of the cinema's worlds) and an integer
// (`+0x30`) that the race previews set to the cinema's index.
export type CinemaObject = CinemaTiming & {
  readonly target: string
  readonly flag: number
}

// A `0x2e` entry. Kind 1, 2 and 3 name an instance of the cinema's worlds (keywords 0x2f, 0x30, 0x31); kind 2 is a skeleton
// instance, whose animation clip is `flag`; kind 4 has two integers instead. The instance is shown with this position and
// orientation (forward and up vectors, the instance's frame) while the entry is on the timeline (hypothesis for the kinds:
// the data has kinds 1 and 2 only).
export type CinemaAction = CinemaTiming & {
  readonly kind: number
  readonly instanceName: string
  readonly position: FloatTriple
  readonly forward: FloatTriple
  readonly up: FloatTriple
  readonly flag: number
  // Keyword 0x36: records of five integers (unused by the shipped files).
  readonly keys: readonly (readonly number[])[]
}

// A `0x37` entry: a dummy object at a place (the flashes `MM_FLSH`, the snow emitters, a radar).
export type CinemaDummy = CinemaTiming & {
  readonly position: FloatTriple
  readonly forward: FloatTriple
  readonly up: FloatTriple
}

// A `0x35` entry (ambient light colour) or a `0x3a` entry (directional light colour and direction).
export type CinemaLight = CinemaTiming & {
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly direction: FloatTriple | null
}

export type Cinema = {
  readonly name: string
  readonly lengthFrames: number
  readonly framesPerSecond: number
  readonly objects: readonly CinemaObject[]
  readonly actions: readonly CinemaAction[]
  readonly dummies: readonly CinemaDummy[]
  readonly ambientLights: readonly CinemaLight[]
  readonly directionalLights: readonly CinemaLight[]
}

export type CinemaDatabase = {
  // Keyword 0x28: the worlds (`MENUDATA\<set>\<name>.WDB`) every cinema of the file shows.
  readonly worldNames: readonly string[]
  readonly cinemas: readonly Cinema[]
  readonly readByteCount: number
}

export type CinemaOrientation = { readonly forward: FloatTriple; readonly up: FloatTriple }
