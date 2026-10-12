import type { RacePreviewClock } from './race-preview.types.ts'
import type { BitmapFont, FontDrawCommand } from '../../font-rendering/index.ts'
import type {
  BuilderCatalog,
  BuilderSession,
  CarDesign,
  SavedCar,
} from '../../car-builder/index.ts'
import type { BodyPartCatalog, DriverSession } from '../../figure-builder/index.ts'
import type { SkeletalAnimation, SkeletonAnimationState } from '../../skeletal-animation/index.ts'
import type {
  RacerShowcase,
  RacerShowcaseAnimation,
} from './racer-showcase/racer-showcase.types.ts'
import type { MenuFigureAnimation } from './menu-figure/menu-figure-animation.types.ts'
import type { DriverDatabase } from '../../driver-database/index.ts'
import type { CircuitDatabase } from '../../circuit-database/index.ts'
import type { MenuFile } from '../../menu-file/index.ts'
import type { SaveFile, SaveRacer } from '../../save-data/index.ts'
import type { RaceCatalog } from '../../race-catalog/index.ts'
import type { RandomTable } from '../../random-table/index.ts'

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
  // The brick database, colours and car sets of the builder screen (MENUDATA\PIECEDB, 0x0042d730), read on first use.
  readonly getBuilderCatalog: () => BuilderCatalog
  // The racer record a new car is saved with: the driver, name and colours of the first racer of `DEFAULT.LRS`.
  readonly getRacerTemplate: () => SaveRacer
  // The first racer of `DEFAULT.LRS` with his design loaded: the car and driver a player who built nothing has.
  readonly getDefaultCar: () => SavedCar
  // `BODYPART.PCB` (0x00498740): the hats, heads, torsos and legs of the driver editor.
  readonly getDriverCatalog: () => BodyPartCatalog
  // `DRIVERS.DDB` of the menus: the main menu shows the figure of one of its drivers.
  readonly getDriverDatabase: () => DriverDatabase
  // `MENUDATA\LEGOMAN.ADB`: the clips of the main menu's figure.
  readonly getMenuFigureAnimation: () => SkeletalAnimation
  // `MENUDATA\RSANIM.ADB` and the idle clips of the racer showcase.
  readonly getRacerShowcaseAnimation: () => RacerShowcaseAnimation
}

// What the menus read from the machine: the original's input manager (`+0x98` of it counts the controllers).
export type FrontEndEnvironment = {
  readonly controllerCount: number
  // The progression hook (the save files and the circuit unlocks are another module): bit n set = circuit n open.
  readonly unlockedCircuitMask: number
  // The game's random table (0x004befec, read from LEGORacers.exe): the mix button draws from it.
  readonly randomTable: RandomTable
  // Progression hook: the driver parts the save has earned. True offers every part (no save exists yet).
  readonly isEveryPartUnlocked: boolean
  // The racers the player has built (the garage and the save files are another module); each is a driver code.
  readonly playerRacerNames: readonly string[]
  // The circuit just played, best first: what the circuit result screens (0x16..0x19) list. Empty otherwise.
  readonly standingRows: readonly FrontEndStandingRow[]
}

export type FrontEndInput =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'accept'
  | 'back'
  // The car builder's own keys (0x00473ee0 reads the numeric keypad and A, S, D, X): turn the brick, take the last one
  // off, the piece and set choosers, and the camera.
  | 'rotate'
  | 'undo'
  | 'previous_piece'
  | 'next_piece'
  | 'previous_set'
  | 'next_set'
  | 'view_left'
  | 'view_right'
  | 'view_up'
  | 'view_down'

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
  // The car the player built in this session (kept in memory; saving it is another task): null drives the save's racer.
  readonly playerCar: SavedCar | null
  // The game's shared random position (0x004c6ee4) as the menus leave it (the mix button advances it).
  readonly randomPosition: number
  // The loaded save file (null without one: the session's own defaults apply) and the racer of it who plays.
  readonly saveFile: SaveFile | null
  readonly racerIndex: number
}

// What survives from one visit of the menus to the next.
export type FrontEndMemory = Pick<
  FrontEndSettings,
  'playerCar' | 'randomPosition' | 'saveFile' | 'racerIndex'
>

// `demonstration`: the main menu waited 60 seconds (0x00481450) and the game starts the attract-mode race.
export type FrontEndOutcome = 'running' | 'race' | 'quit' | 'demonstration'

// What the front end hands over when its idle timer runs out: where the shared random cursor stands.
export type FrontEndDemonstrationRequest = {
  readonly randomPosition: number
}

export type FrontEndSelection = {
  readonly focusIndex: number
  readonly circuitIndex: number
  readonly raceIndex: number
  readonly racerIndex: number
  readonly tabIndex: number
  readonly isDialogOpen: boolean
  // The text a screen is editing (the new racer's name).
  readonly text: string
}

export type FrontEndScreenState = {
  readonly screenId: number
  readonly selection: FrontEndSelection
}

export type FrontEndState = {
  // The builder screen's car and cursor, kept while the menus run (the screen at `+0x2308`).
  readonly builder: BuilderSession | null
  // The driver editor's choosers while it is open.
  readonly driver: DriverSession | null
  // The front end's own stack (0x0047fa00): the screens below the current one.
  readonly screens: readonly FrontEndScreenState[]
  readonly settings: FrontEndSettings
  readonly outcome: FrontEndOutcome
  // Milliseconds since the current screen opened.
  readonly screenMilliseconds: number
  // The race select's preview timers.
  readonly racePreview: RacePreviewClock
  // The entry of MENUDATA\LEGOMSC the music stream plays (FrontEnd_SetMusic 0x00480470), or null before any.
  readonly musicListIndex: number | null
  // The main menu's figure and its timers; they run only while that screen is the top one.
  readonly menuFigure: MenuFigureAnimation | null
  // The race select's racer showcase, while that screen is on top.
  readonly showcase: RacerShowcase | null
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
  // 0xAARRGGBB the image's pixels are multiplied by (the race selects tint their frame); absent: untinted.
  readonly tint?: number
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
  // The car the builder screen shows in the world, and the view it is seen from; null for any other viewport.
  readonly builder: BuilderPreview | null
  // The driver the editor shows on the platform; null for any other viewport.
  readonly driver: DriverPreview | null
  // The racer showcase of the race select; null for any other viewport.
  readonly showcase: RacerShowcaseView | null
  // The race cinema of the single race and circuit race screens; null for any other viewport.
  readonly cinema: RaceCinemaView | null
}

// The race preview a race select shows (`MENUDATA\SINGRACE\PST.CDB`): the cinema of the race (the catalogue's second name)
// and the milliseconds since the screen opened (hypothesis: the cinema's clock starts with the screen).
export type RaceCinemaView = {
  readonly cinemaName: string
  readonly milliseconds: number
  // The five part bytes of the race's champion (the race's third name, looked up in the menus' driver database,
  // 0x00488b40): the figure that takes the place of the cinema's `guy1`; null when the database has no such driver.
  readonly partBytes: readonly number[] | null
}

// The racer of the save the showcase shows: his car, turning on the turntable, and his driver standing on the platform.
export type RacerShowcaseView = {
  // null when the record's bytes load no car.
  readonly design: CarDesign | null
  // The chassis (CHASSIS.CMB) whose wheels the car stands on.
  readonly chassisName: string
  readonly driver: DriverPreview
  // Milliseconds of the turntable's clock (`CRSDOW.ADB`), from the first frame of the screen.
  readonly turntableMilliseconds: number
}

export type DriverPreview = {
  // The five part bytes the figure builder takes: hat, face, torso, legs, expression.
  readonly partBytes: readonly number[]
  // Where the figure stands in the screen's world and the way it faces (its frame's forward vector).
  readonly position: readonly [number, number, number]
  readonly forward: readonly [number, number, number]
  // The animation file (in MENUDATA, without extension) the pose's clips are of: `LEGOMAN` (the main menu), `RSANIM`
  // (the racer showcase).
  readonly animationName: string
  // The pose the screen's behaviour has put the figure in; null leaves the viewer to play the first clip.
  readonly animation: SkeletonAnimationState | null
}

export type BuilderPreview = {
  // The placed bricks and the brick in the cursor, as one design (the mesh builder draws both).
  readonly design: CarDesign
  readonly cameraYaw: number
  readonly cameraPitch: number
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
  readonly playerCar: SavedCar | null
  readonly randomPosition: number
}

export type FrontEndStep = {
  readonly state: FrontEndState
  readonly soundNames: readonly string[]
  // The music list entry this step starts, or null when the tune playing goes on.
  readonly musicListIndex: number | null
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

// The front end after a screen opened, and the music list entry its opening started (null: none).
export type OpenedScreen = {
  readonly state: FrontEndState
  readonly musicListIndex: number | null
}
