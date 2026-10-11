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
  // Milliseconds since the screen opened (the circuit race screen cycles its races on it).
  readonly screenMilliseconds: number
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
