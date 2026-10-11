import type { BitmapFont, FontDrawCommand } from '../../font-rendering/index.ts'
import type { CircuitDatabase } from '../../circuit-database/index.ts'
import type { MenuFile } from '../../menu-file/index.ts'
import type { RaceCatalog } from '../../race-catalog/index.ts'

// A decoded menu image (MENUDATA\<name>.BMP) with the image database's colour key applied.
export type FrontEndImage = {
  readonly name: string
  readonly width: number
  readonly height: number
  // RGBA, rows top to bottom.
  readonly colors: Uint8Array
}

export type FrontEndScreenFiles = {
  readonly description: MenuFile
  // The screen's own styles (`<screen>.MSB`); null for a screen without one.
  readonly styles: MenuFile | null
}

// Everything the front end reads from the player's files, parsed (see loadFrontEndResources).
export type FrontEndResources = {
  // MENUNAME.SRF: the names of the screens (ids 0 .. 0x31) and of the items and styles the screens look up by id.
  readonly menuNames: readonly string[]
  // MENUDATA\<language>\MENUTEXT.SRF and CIRCUIT.SRF.
  readonly getMenuText: (stringId: number) => string
  readonly getCircuitText: (stringId: number) => string
  readonly circuits: CircuitDatabase
  readonly races: RaceCatalog
  readonly globalStyles: MenuFile
  readonly getScreenFiles: (screenName: string) => FrontEndScreenFiles | null
  readonly getFont: (fontName: string) => BitmapFont | null
  readonly getImage: (imageName: string) => FrontEndImage | null
  // The font image (colour key applied) the glyph rectangles of `getFont` point into.
  readonly getFontImage: (fontName: string) => FrontEndImage | null
}

// What the menus read from the machine: the original's input manager (`+0x98` of it counts the controllers).
export type FrontEndEnvironment = {
  readonly controllerCount: number
  // The progression hook (the save files and the circuit unlocks are another module): bit n set = circuit n open.
  readonly unlockedCircuitMask: number
  // The racers the player has built (the garage and the save files are another module); each is a driver code.
  readonly playerRacerNames: readonly string[]
  // The circuit just played, best first: what the circuit result screens (0x16..0x19) list. Empty otherwise.
  readonly standingRows: readonly FrontEndStandingRow[]
}

export type FrontEndInput = 'up' | 'down' | 'left' | 'right' | 'accept' | 'back'

export type FrontEndMode = 'circuit' | 'single_race' | 'time_trial'

// A race of the race catalog the menus chose: its key, its folder below GAMEDATA and its flag (`+0x40`, `+0x48`, `+0x3c`).
export type FrontEndRaceSlot = {
  readonly raceName: string
  readonly raceFolder: string
  readonly isRaceFlagged: boolean
}

// The game settings object the menus fill (race `+4`, RaceSession `+0`): the fields the front end writes.
export type FrontEndSettings = {
  // `+0x24`: 0 circuit race, 1 single race, 2 time trial.
  readonly mode: FrontEndMode
  // Frontend `+0x4bb8` bit 2: the versus race was chosen on the main menu.
  readonly isVersus: boolean
  // `+0x2d`: the circuit's key; empty until one is chosen.
  readonly circuitName: string
  // `+0x40`, `+0x48` and `+0x3c`: the chosen race (a single race and a time trial); empty until one is chosen.
  readonly raceName: string
  readonly raceFolder: string
  readonly isRaceFlagged: boolean
  // 0x0047a0e0: the races of the chosen circuit, copied into the settings in the order of the circuit's slots.
  readonly circuitRaces: readonly FrontEndRaceSlot[]
  // `+0x100`: the opponents the menus chose, then (after the racer pick) the racer count.
  readonly racerCount: number
  // `+0x2c`: the versus race's laps.
  readonly lapCount: number
  // `+0x32c`: the players at the front end's end.
  readonly localPlayerCount: number
  // The driver codes of the racers the player picked, one per local player.
  readonly playerRacerNames: readonly string[]
}

export type FrontEndOutcome = 'running' | 'race' | 'quit'

export type FrontEndSelection = {
  readonly focusIndex: number
  readonly circuitIndex: number
  readonly raceIndex: number
  readonly racerIndex: number
  readonly tabIndex: number
  readonly isDialogOpen: boolean
}

export type FrontEndScreenState = {
  readonly screenId: number
  readonly selection: FrontEndSelection
}

export type FrontEndState = {
  // The front end's own stack (0x0047fa00): the screens below the current one.
  readonly screens: readonly FrontEndScreenState[]
  readonly settings: FrontEndSettings
  readonly outcome: FrontEndOutcome
  // Milliseconds since the current screen opened.
  readonly screenMilliseconds: number
}

export type FrontEndRectangle = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type FrontEndImageCommand = {
  readonly kind: 'image'
  readonly imageName: string
  readonly left: number
  readonly top: number
  // The part of the image drawn, from its top left corner (tiles at an edge are cut).
  readonly width: number
  readonly height: number
}

export type FrontEndTextCommand = {
  readonly kind: 'text'
  readonly fontName: string
  readonly glyphs: readonly FontDrawCommand[]
  // 0xAARRGGBB the glyph pixels are multiplied by.
  readonly color: number
}

export type FrontEndFillCommand = {
  readonly kind: 'fill'
  readonly rectangle: FrontEndRectangle
  // 0xAARRGGBB at the top; a different bottom colour makes a vertical gradient.
  readonly color: number
  readonly bottomColor: number
}

// The 3D object a screen shows in a rectangle (a world file of MENUDATA) and its camera (hypothesis: the nine
// floats of the item are the camera position, orientation and clipping).
export type FrontEndViewportCommand = {
  readonly kind: 'viewport'
  readonly modelName: string
  readonly rectangle: FrontEndRectangle
  readonly camera: readonly number[]
}

export type FrontEndDrawCommand =
  FrontEndImageCommand | FrontEndTextCommand | FrontEndFillCommand | FrontEndViewportCommand

export type FrontEndFrame = {
  readonly commands: readonly FrontEndDrawCommand[]
  // Sounds of MENUDATA\SOUNDS the step asked for, by file name without `.pcm`.
  readonly soundNames: readonly string[]
}

// What leaves the front end when a race is chosen: the game settings of the race session.
export type FrontEndRaceRequest = {
  readonly mode: FrontEndMode
  readonly raceName: string
  readonly raceFolder: string
  readonly isRaceFlagged: boolean
  readonly circuitRaces: readonly FrontEndRaceSlot[]
  readonly circuitName: string
  readonly racerCount: number
  readonly localPlayerCount: number
  readonly lapCount: number
  readonly playerRacerNames: readonly string[]
}

export type FrontEndStep = {
  readonly state: FrontEndState
  readonly soundNames: readonly string[]
}

// A font of the menus with the image its glyphs are drawn from.
export type FrontEndFontEntry = {
  readonly font: BitmapFont
  readonly image: FrontEndImage
}

// One line of a circuit's final standings (the points record of CircuitRunner +4).
export type FrontEndStandingRow = {
  readonly rank: number
  readonly racerName: string
  readonly points: number
  readonly isPlayer: boolean
}
