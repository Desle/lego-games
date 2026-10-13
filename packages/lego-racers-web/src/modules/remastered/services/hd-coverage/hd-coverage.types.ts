import type { FrontEndInput } from '@lego-games/lego-racers/front-end'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const RacerPartKind = createEnum({
  BODY: 'body',
  WHEELS: 'wheels',
  DRIVER: 'driver',
})

export const CoverageOrigin = createEnum({
  LAYER: 'layer',
  ORIGINAL: 'original',
})

export const HookKind = createEnum({
  CAR: 'car',
  DRIVER: 'driver',
})

// Why a racer part was drawn by the original. Only `no_model_file` is allowed: the folder has nothing to draw it with.
export const FallbackReason = createEnum({
  NO_MODEL_FILE: 'no_model_file',
  HOOK_NOT_CALLED: 'hook_not_called',
  NO_DRAWING: 'hook_returned_no_drawing',
  DRAWING_FAILED: 'drawing_failed',
  DRAWING_NOT_SHOWN: 'drawing_not_shown',
})

// How a part line of a model file failed to reach the screen.
export const PartLoss = createEnum({
  UNPARSED: 'unparsed',
  INVISIBLE: 'invisible',
  DROPPED: 'dropped',
})

export type PartLoss = EnumValues<typeof PartLoss>
export type RacerPartKind = EnumValues<typeof RacerPartKind>
export type CoverageOrigin = EnumValues<typeof CoverageOrigin>
export type HookKind = EnumValues<typeof HookKind>
export type FallbackReason = EnumValues<typeof FallbackReason>

// What an original racer mesh is: a car body (a champion's by its code, or a built car), a chassis's wheels, or a driver (a
// champion's race model by its name, or a figure built from part bytes).
export type RacerPartIdentity = {
  readonly kind: RacerPartKind
  readonly key: string
}

// What the instance group of an original mesh says about itself (`createInstanceGroup` tags it).
export type InstanceSource = {
  readonly instanceName: string
  readonly meshPath: string
  readonly worldPath: string
}

// One call of `getCarDrawing` or `getDriverDrawing` in a place, and what came of it.
export type HookCall = {
  readonly id: number
  readonly hook: HookKind
  // A car: its champion code or `design:<chassis>`; a driver: its model name or `parts:<bytes>`.
  readonly key: string
  // A car's wheel model name (lower case); null for a driver.
  readonly wheelsKey: string | null
  // Whether the models folder has what the layer needs to draw it.
  readonly isModelPresent: boolean
  readonly isDrawingReturned: boolean
  readonly isFailed: boolean
}

// A racer part seen in a rendered frame: drawn by the layer (a drawing a call returned) or by the original.
export type CensusSighting = {
  readonly origin: CoverageOrigin
  readonly kind: RacerPartKind
  readonly key: string
  readonly callId: number | null
}

// What a rendered scene draws: the racer parts, and the other original instances (`world|mesh file|instance`).
export type Census = {
  readonly sightings: readonly CensusSighting[]
  readonly otherSources: readonly string[]
}

// A part line of a model file (`1 <colour> <matrix> <part>.dat`).
export type ModelPartLine = {
  readonly lineNumber: number
  readonly color: string
  readonly part: string
  readonly text: string
}

// A part line of a model file the layer's drawing of it does not show where the file puts it.
export type ModelPartFinding = {
  readonly model: string
  readonly lineNumber: number
  readonly part: string
  readonly text: string
  readonly loss: PartLoss
}

// The models folder's cars, each drawn alone by the layer and checked part by part.
export type ModelPartsPlace = {
  readonly kind: 'model_parts'
  readonly name: string
}

// The models the folder has, as the layer reads them (`index.json`).
export type ModelFolderIndex = {
  readonly cars: readonly string[]
  readonly chassis: readonly string[]
}

export type HdCoveragePlaceResult = {
  readonly name: string
  readonly calls: readonly HookCall[]
  readonly sightings: readonly CensusSighting[]
  // The other original instances the censused frames drew, for a reader who looks for a racer the classification missed.
  readonly otherSources: readonly string[]
  readonly renderCount: number
  readonly modelIndex: ModelFolderIndex
  // Calls whose drawing had not finished building when the frames were drawn.
  readonly unsettledCallIds: readonly number[]
  // The part lines of the models drawn in the place that did not reach the screen.
  readonly partFindings: readonly ModelPartFinding[]
  // Where each driver of the place sits, the original's and the layer's.
  readonly driverSeats: readonly DriverSeatMeasurement[]
}

// A racer the original drew in a place, and why the layer did not.
export type HdCoverageFinding = {
  readonly place: string
  readonly kind: RacerPartKind
  readonly key: string
  readonly reason: FallbackReason
  // The models folder has a model for it (every reason but `no_model_file`).
  readonly isFallback: boolean
  // A racer the layer has no path for yet (`KNOWN_COVERAGE_GAPS`).
  readonly isKnownGap: boolean
}

// A racer of a place the layer is known not to draw yet.
export type CoverageGap = {
  readonly place: string
  readonly kind: RacerPartKind
  readonly key: string
}

// A menu screen: the front end opened on a screen (null: the main menu) and stepped with keys, censused at the record steps.
export type FrontEndPlace = {
  readonly kind: 'front_end'
  readonly name: string
  readonly firstScreenId: number | null
  readonly inputs: readonly (FrontEndInput | null)[]
  readonly recordSteps: readonly number[]
}

// A race of the game session the menus start: the player in a garage car, censused at the record frames.
export type RacePlace = {
  readonly kind: 'race'
  readonly name: string
  readonly mode: 'single_race' | 'circuit' | 'time_trial'
  readonly raceFolder: string
  readonly racerCount: number
  readonly localPlayerCount: number
  // A time trial whose session has a finished run: the best run's ghost drives beside the champion's.
  readonly isBestRunShown: boolean
  readonly frameCount: number
  readonly recordFrames: readonly number[]
}

// Every champion and a garage car on every chassis the folder has a recipe for, each driver measured on its seat.
export type DriverSeatsPlace = {
  readonly kind: 'driver_seats'
  readonly name: string
}

export type HdCoveragePlace = FrontEndPlace | RacePlace | ModelPartsPlace | DriverSeatsPlace

// The page of the coverage trace: the runner `installHdCoverageHarness` hangs on the window.
export type HdCoverageWindow = {
  readonly runHdCoveragePlace: (place: HdCoveragePlace) => Promise<HdCoveragePlaceResult>
}

// A racer whose driver's seat is measured: the car (a champion's code or a garage design's chassis), the seat point of its
// appearance (the car's frame, studs), the original driver's model, and the text of the LDraw car the layer draws (null: none).
export type DriverSeatSubject = {
  readonly racer: string
  readonly seatPoint: { readonly x: number; readonly y: number; readonly z: number }
  readonly driverModel: ModelScene
  readonly driverModelName: string | null
  readonly driverPartBytes: readonly number[] | null
  readonly ldrawCarText: string | null
}

// How far to the car's left (LDraw units) the driver sits: the seat point, the original driver's torso, the LDraw driver's torso,
// and the LDraw car's steering wheel (null when not measured: no drawing, no LDraw car or no steering wheel in it).
export type DriverSeatMeasurement = {
  readonly racer: string
  // The race's pose the driver was measured in (`seated`, `steering`).
  readonly pose: string
  readonly seatOffset: number
  readonly originalDriverOffset: number | null
  readonly ldrawDriverOffset: number | null
  readonly steeringWheelOffset: number | null
}

// A pose of the race's seated driver: a clip of its animation and how far into it.
export type DriverSeatPose = {
  readonly name: string
  readonly clipIndex: number
  readonly milliseconds: number
}
