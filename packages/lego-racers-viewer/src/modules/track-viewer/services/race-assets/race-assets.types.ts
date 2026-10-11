import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { RaceDefinition } from '@lego-games/lego-racers/race'
import type { Scene } from '@lego-games/lego-racers/scene'
import type { SoundBank } from '@lego-games/lego-racers/audio'
import type { SceneBackground } from '../../types/track-viewer.types.ts'

// The original files a race needs besides LEGO.JAM: the executable (the race reads its tables) and the music.
export type RaceGameFiles = {
  readonly executable: Uint8Array
  // Music files by lower-case name, e.g. `start.tun`.
  readonly tunes: ReadonlyMap<string, Uint8Array>
}

// One racer's car and driver models.
// PLACEHOLDER: the chassis and driver databases (CHASSIS.CMB, DRIVERS.DDB, CHAMPS.CCB; the `cars-and-drivers`
// branch) say which models a racer uses and where the driver sits; until they are on main every racer takes a model
// pair from RACER_MODEL_PREFIXES and the driver sits at DRIVER_SEAT_OFFSET.
export type RacerModels = {
  readonly car: ModelScene
  readonly driver: ModelScene
}

export type HudImage = {
  readonly name: string
  readonly width: number
  readonly height: number
  // RGBA, rows top to bottom.
  readonly colors: Uint8Array
}

export type RaceAssets = {
  readonly archive: JamArchive
  readonly definition: RaceDefinition
  readonly scene: Scene
  readonly background: SceneBackground
  readonly racerModels: readonly RacerModels[]
  readonly getString: (stringId: number) => string
  readonly imageNames: readonly string[]
  readonly hudImages: ReadonlyMap<string, HudImage>
  readonly generalSounds: SoundBank
  readonly trackSounds: SoundBank
  readonly trackSoundDirectory: string
  readonly musicNames: readonly string[]
  readonly tunes: ReadonlyMap<string, Uint8Array>
}

// LEGO.JAM and the other files, read.
export type LoadedGameFiles = {
  readonly jam: Uint8Array
  readonly files: RaceGameFiles
}
