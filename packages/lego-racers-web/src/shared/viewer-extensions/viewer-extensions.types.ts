import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { DataTexture, Object3D } from 'three'
import { createEnum } from '../types/enum.types.ts'
import type { EnumValues } from '../types/enum.types.ts'

export type TexturePixels = {
  readonly colors: Uint8Array
  readonly width: number
  readonly height: number
}

export type StageSize = {
  readonly width: number
  readonly height: number
}

export type WindowMetrics = {
  readonly innerWidth: number
  readonly innerHeight: number
  readonly devicePixelRatio: number
}

// A texture the viewer just made from an original bitmap, uploaded and drawn as the original's pixels.
export type TextureCreatedEvent = {
  readonly texture: DataTexture
  readonly bitmapPath: string
  readonly originalPixels: TexturePixels
  // Replaces the texture's picture, of any size, by another with the same row order as the original's.
  readonly replacePixels: (pixels: TexturePixels) => void
}

// A picture the viewer just made from an original bitmap of the archive and draws as a 2D image (a menu image, a font sheet).
export type PictureCreatedEvent = {
  readonly archivePath: string
  readonly originalPixels: TexturePixels
  // Replaces the picture by another of any size (RGBA, rows top to bottom); the viewer scales what it draws from it.
  readonly replacePixels: (pixels: TexturePixels) => void
}

// How the race is laid out on the page: the stage the race and the HUD canvases cover, in page pixels.
export type RaceDisplay = {
  readonly stageSize: StageSize
  readonly pixelRatio: number
  // The size the HUD is laid out for; the HUD commands are then moved onto the stage.
  readonly hudDesignSize: StageSize
  // True when the stage fills the whole window instead of being scaled into it.
  readonly isFullWindow: boolean
  readonly getHudCommands: (commands: readonly HudCommand[]) => readonly HudCommand[]
}

// A car built from bricks that the race is about to draw.
export type BuiltCarDrawingRequest = {
  readonly archive: JamArchive
  readonly design: CarDesign
}

// An effect the race draws from a model of the original's (a power-up brick on the track, say).
export type EffectModelDrawingRequest = {
  readonly modelName: string
  // Which look of the model the effect has (the kind of a power-up brick); null when it has one.
  readonly variant: string | null
}

export const RacerPartKind = createEnum({
  WHEELS: 'wheels',
  DRIVER: 'driver',
})
export type RacerPartKind = EnumValues<typeof RacerPartKind>

// A part of a racer the viewer is about to draw from the original's skeleton model: the wheels of the car or its driver.
export type RacerPartDrawingRequest = {
  readonly kind: RacerPartKind
  readonly archive: JamArchive
  // The original's model of the part: the skeleton and the animation set that the poses are given for.
  readonly model: ModelScene
  // The name of the original's model (the chassis's wheel model, the driver's model), null for a driver built from part bytes.
  readonly modelName: string | null
  // The five part bytes (hat, face, torso, legs, expression) a driver is built from, null for a fixed driver model.
  readonly partBytes: readonly number[] | null
}

// What a layer draws in place of a racer's part. Its object is in the original model's frame before the model's scale, so it
// follows the group the viewer moves, leans and scales; the poses reach it through the two functions.
export type RacerPartDrawing = {
  readonly object: Object3D
  // The viewer posed the part from this animation state (what the original poses its skeleton with).
  readonly setAnimationState: (state: SkeletonAnimationState) => void
  // The viewer advanced the part's own animation by whole milliseconds.
  readonly animate: (deltaMilliseconds: number) => void
  readonly dispose: () => void
}

// A choice the developer panel offers for a layer above the original port.
export type DevelopmentSelector = {
  readonly label: string
  readonly options: readonly string[]
  readonly selected: string | null
  readonly onSelected: (option: string | null) => void
}

// What a layer above the original port may change. The viewer draws the original exactly when none is registered.
export type ViewerExtension = {
  readonly onTextureCreated: (event: TextureCreatedEvent) => void
  readonly onPictureCreated: (event: PictureCreatedEvent) => void
  // The scale of the menu surface relative to its 640 x 480 design, given the device pixels the menu covers per design pixel.
  readonly getMenuSurfaceScale: (devicePixelsPerDesignPixel: number) => number | null
  // A recording to play in place of the original sound or tune at this archive path; null keeps the original.
  readonly getSoundReplacement: (
    context: BaseAudioContext,
    archivePath: string
  ) => Promise<AudioBuffer | null>
  readonly getRaceDisplay: (window: WindowMetrics) => RaceDisplay | null
  // Something to draw in place of the mesh the original builds for a car built from bricks, in that mesh's frame; null keeps the original's.
  readonly getBuiltCarDrawing: (request: BuiltCarDrawingRequest) => Object3D | null
  // Something to draw in place of the model the original draws for an effect, in that model's frame (the original's units, its scale applied); null keeps the original's.
  readonly getEffectModelDrawing: (request: EffectModelDrawingRequest) => Object3D | null
  // Something to draw in place of a racer's wheels or driver, posed by the viewer; null keeps the original's.
  readonly getRacerPartDrawing: (request: RacerPartDrawingRequest) => RacerPartDrawing | null
  // The selections the layer runs with (texture pack, audio pack, bricks), for the notes of a recording.
  readonly getSelections: () => readonly string[]
}
