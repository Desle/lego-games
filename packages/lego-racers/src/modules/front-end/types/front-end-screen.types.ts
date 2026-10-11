import type { SkeletonAnimationState } from '../../skeletal-animation/index.ts'
import type { BuilderSession } from '../../car-builder/index.ts'
import type { DriverSession } from '../../figure-builder/index.ts'
import type {
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndResources,
  FrontEndSelection,
  FrontEndSettings,
} from './front-end.types.ts'
import type { FrontEndWidget } from './front-end-widget.types.ts'

// What a screen sees when it draws or reads input.
export type ScreenRuntime = {
  readonly resources: FrontEndResources
  readonly environment: FrontEndEnvironment
  readonly settings: FrontEndSettings
  readonly selection: FrontEndSelection
  // The builder screen's car (null until it opens).
  readonly builder: BuilderSession | null
  readonly driver: DriverSession | null
  // Milliseconds since the screen opened (the circuit race screen cycles its races on it).
  readonly screenMilliseconds: number
  // The main menu figure's pose (null on the other screens and before it exists).
  readonly menuFigureAnimation: SkeletonAnimationState | null
}

// What a screen asks of the front end when it handles an input (the original's target screen, 0x360 of the screen,
// acted on by the screen's 0x004812c0-style handler: push a screen, pop one, start the race, or leave).
export type ScreenNavigation =
  | { readonly kind: 'none' }
  | { readonly kind: 'push'; readonly screenId: number }
  | { readonly kind: 'pop' }
  | { readonly kind: 'race' }
  | { readonly kind: 'quit' }

export type ScreenResult = {
  readonly selection: FrontEndSelection
  readonly settings: FrontEndSettings
  readonly builder: BuilderSession | null
  readonly driver: DriverSession | null
  readonly navigation: ScreenNavigation
  // Sounds of MENUDATA\SOUNDS by file name (without `.pcm`); see front-end.md for how they were chosen.
  readonly soundNames: readonly string[]
}

export type ScreenDefinition = {
  readonly screenId: number
  // The MIB / MSB name of the screen (a MENUNAME.SRF string).
  readonly getWidgets: (runtime: ScreenRuntime) => readonly FrontEndWidget[]
  readonly handleInput: (runtime: ScreenRuntime, input: FrontEndInput) => ScreenResult
}

export type MainMenuButton = {
  readonly itemName: string
  readonly labelId: number
  // The screen the button opens (0x00481150); 0 asks to quit.
  readonly targetScreenId: number
  // What the button does to the versus flag: "vs" sets it, "circuit" and "single" clear it, the rest keep it.
  readonly versusFlag: 'set' | 'clear' | 'keep'
}

export type OptionsButton = {
  readonly itemName: string
  readonly labelId: number
  // The tab the button opens (0x004832d0 sets 0x369 of the screen) or the screen it pushes.
  readonly tabIndex: number | null
  readonly targetScreenId: number | null
}

export type RaceSelectionKind = 'circuit_race' | 'single_race' | 'time_trial'

// An entry of the garage page: the button, its label string and the screen it opens (null: back).
export type GarageEntry = {
  readonly itemName: string
  readonly labelId: number
  readonly targetScreenId: number | null
}
