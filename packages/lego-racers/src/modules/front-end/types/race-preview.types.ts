import type { CinemaDatabase, CinemaEvents } from '../../cinema/index.ts'
import type { Cinema } from '../../cinema/index.ts'
import type { EmitterList, EmitterPool, EmitterRandom } from '../../emitter/index.ts'
import type { MaterialAnimation } from '../../material-animation/index.ts'

// The timers of the race select's preview (screen +0x2218 and +0x2220): the race on show, the time until the next one and
// the clock of the cinema, which restarts with each race.
export type RacePreviewClock = {
  readonly remainingMilliseconds: number
  // The races switched to since the screen opened (the race on show is this modulo the circuit's races).
  readonly cycleCount: number
  readonly cinemaMilliseconds: number
}

// The files of the race preview (`MENUDATA\SINGRACE`): the cinemas, their events and the emitter pool of each emitter file the
// events name (the emitters and their material animation).
export type RacePreviewResources = {
  readonly cinemas: CinemaDatabase
  readonly events: CinemaEvents
  readonly pools: readonly RacePreviewPoolFiles[]
}

export type RacePreviewPoolFiles = {
  readonly emitters: EmitterList
  readonly animation: MaterialAnimation | null
}

// An emitter the preview has started for a dummy of the cinema (the handle slot of the pool).
export type RacePreviewStartedEmitter = {
  readonly dummyIndex: number
  readonly handleIndex: number | null
}

// The emitters of the cinema on show (the cinema's pool: 3 instances, `FUN_004a1240`), advanced with the preview.
export type RacePreviewEmitters = {
  readonly cinemaName: string
  readonly pool: EmitterPool
  readonly started: readonly RacePreviewStartedEmitter[]
}

export type RacePreviewEmittersStep = {
  readonly emitters: RacePreviewEmitters | null
  // The random table position after the draws of the step.
  readonly randomPosition: number
}

export type RacePreviewEmittersInput = {
  readonly previous: RacePreviewEmitters | null
  readonly resources: RacePreviewResources
  // The cinema on show, or null on a screen without a preview.
  readonly cinema: Cinema | null
  // The cinema's clock before and after the frame, and the frame's time.
  readonly previousMilliseconds: number
  readonly milliseconds: number
  readonly frameMilliseconds: number
  // The screen opened or the race changed in this frame (the cinema started again).
  readonly isRestarted: boolean
  readonly random: EmitterRandom
}

// The pool after one dummy started its emitter (null: the dummy has no emitter event or the pool had no room).
export type RacePreviewDummyStart = {
  readonly pool: EmitterPool
  readonly started: RacePreviewStartedEmitter | null
}

// The pool after the dummies on the timeline started and stopped their emitters.
export type RacePreviewStartedPool = {
  readonly pool: EmitterPool
  readonly started: readonly RacePreviewStartedEmitter[]
}

// A vertex effect that is on (`FUN_004a4be0`'s 0x48-byte object): the instance it shifts, its shifts and rates, and the biases
// it holds as floats (`+0x30`, `+0x34`, `+0x38`), which the rates move.
export type RacePreviewVertexEffect = {
  readonly dummyIndex: number
  readonly instanceName: string
  readonly shifts: readonly number[]
  readonly rates: readonly number[]
  readonly currentBiases: readonly number[]
}

export type RacePreviewEffects = {
  readonly cinemaName: string
  readonly active: readonly RacePreviewVertexEffect[]
}

export type RacePreviewEffectsInput = {
  readonly previous: RacePreviewEffects | null
  readonly cinema: Cinema | null
  readonly events: CinemaEvents
  // The cinema's clock before and after the frame, and the frame's time.
  readonly previousMilliseconds: number
  readonly milliseconds: number
  readonly frameMilliseconds: number
  // The screen opened or the race changed in this frame: the old effects stop and the new cinema's start.
  readonly isRestarted: boolean
}

// What the viewer applies to an instance's vertex colours: `(channel >> shift) + bias`, clamped (alpha is not shifted).
export type RacePreviewColourShift = {
  readonly instanceName: string
  readonly shifts: readonly number[]
  readonly biases: readonly number[]
}
