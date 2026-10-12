import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { FigureAnimation } from '@lego-games/lego-racers/racer'
import type { ModelResourceNames } from '@lego-games/lego-racers/racer-appearance'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { RaceDefinition } from '@lego-games/lego-racers/race'
import type { Scene } from '@lego-games/lego-racers/scene'
import type { SoundBank } from '@lego-games/lego-racers/audio'
import type { HudFonts, HudImage } from '../../types/hud-fonts/hud-fonts.types.ts'
import type { SceneBackground } from '../../types/track-viewer.types.ts'

// The original files a race needs besides LEGO.JAM: the executable (the race reads its tables) and the music.
export type RaceGameFiles = {
  readonly executable: Uint8Array
  // Music files by lower-case name, e.g. `start.tun`.
  readonly tunes: ReadonlyMap<string, Uint8Array>
}

// One racer's car, wheels and driver. The wheels and the driver have bones that the race's figures animate; the body
// of a champion's car is a plain model. A racer with a car built from bricks has no body or driver here until the car
// builder and the figure builder make them (null).
export type RacerModels = {
  readonly body: ModelScene | null
  readonly wheels: ModelScene
  readonly driver: ModelScene | null
}

// The models of the effects the race draws (GAMEDATA\COMMON): the rocket and the magnet have bones, the barrel and the
// spiked explosion are plain. The cannon ball, the grapple hook, the wand's beam and the plain explosion are not drawn:
// the files that give them their look are not traced (projectiles.md).
// A model with the animation set its figure plays.
export type EffectFigureModel = {
  readonly model: ModelScene
  readonly animations: readonly FigureAnimation[]
  // The texture scroll per second (keyword 0x3f of its instance).
  readonly scroll: readonly [number, number]
}

export type EffectModels = {
  // The materials and textures of the power-up libraries (the cannon ball, the beams and the flames name them).
  readonly materials: Scene
  readonly rocket: ModelScene
  readonly rocketAnimations: readonly FigureAnimation[]
  readonly barrel: ModelScene
  readonly magnet: ModelScene
  readonly spikedExplosion: ModelScene
  // The shield around a racer by level (0 to 3).
  readonly shields: readonly ModelScene[]
  // The animation set the four shields share (SHEOUT0.ADB), for the figure that plays it.
  readonly shieldAnimations: readonly FigureAnimation[]
  readonly shieldScroll: readonly [number, number]
  // The three figures of a turbo by level (0 to 2): the burn behind the car and its two flames (0x0045c8f0).
  // The warp's portal (the instance warpprt of POWERUP.WDB: the mesh warphole).
  readonly warpPortal: ModelScene
  readonly warpPortalScroll: readonly [number, number]
  readonly turbos: readonly (readonly EffectFigureModel[])[]
  // The power-up brick in the colour of each kind (projectile, shield, turbo, hazard).
  readonly powerUpBricks: Readonly<Record<string, ModelScene>>
  readonly enhancementBrick: ModelScene
  // The warp's tunnel (TURBO3.WDB lists `dbricks` and `dtube`; 0x0045d940 draws them).
  readonly warpTunnel: Scene
  // The texture scroll per second of the tube (the world's keyword 0x3f on `dtube`: u, v), which the original adds to the
  // texture coordinates while the warp runs.
  readonly warpTextureScroll: readonly [number, number]
}

export type RaceAssets = {
  readonly archive: JamArchive
  readonly definition: RaceDefinition
  readonly scene: Scene
  readonly background: SceneBackground
  readonly racerModels: readonly RacerModels[]
  readonly effectModels: EffectModels
  readonly getString: (stringId: number) => string
  readonly imageNames: readonly string[]
  // The race description's display bounds (keyword 0x46) the minimap maps the world onto, or null.
  readonly displayBounds: readonly [number, number, number, number] | null
  readonly hudImages: ReadonlyMap<string, HudImage>
  readonly hudFonts: HudFonts
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
  // Reads a music file (e.g. `knight.tun`) next to LEGO.JAM; null when it is missing.
  readonly readTune: (name: string) => Promise<Uint8Array | null>
}

export type { HudBitmapFont, HudFonts, HudImage } from '../../types/hud-fonts/hud-fonts.types.ts'

// Loads a racer's model into the race's container (see createModelLoader).
export type ModelLoader = (names: ModelResourceNames) => ModelScene
