import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type {
  DataTexture,
  Group,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'

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

// The race's drawing as a layer may add to it before each frame is rendered.
export type RaceRenderRequest = {
  readonly renderer: WebGLRenderer
  readonly camera: PerspectiveCamera
  readonly trackScene: Scene
  // The objects of the track's world (its instances, one group each, tagged with `userData.instanceKind`), in the track's own frame.
  readonly trackGroup: Group
  // The world path of the track's BSP tree: what tells one track from another.
  readonly trackKey: string
}

// Work a layer does just before the race's scenes are rendered (after the poses are set).
export type RaceRenderPass = {
  readonly beforeRender: () => void
  readonly dispose: () => void
}

// An effect the race draws from a model of the original's (a power-up brick on the track, say).
export type EffectModelDrawingRequest = {
  readonly modelName: string
  // Which look of the model the effect has (the kind of a power-up brick); null when it has one.
  readonly variant: string | null
}

// A skeleton model of the original's and what names it to a layer: the wheels of a chassis or a driver.
export type RacerDrawingPart = {
  readonly model: ModelScene
  // The name of the original's model (the chassis's wheel model, the driver's model), null for a driver built from part bytes.
  readonly modelName: string | null
  // The five part bytes (hat, face, torso, legs, expression) a driver is built from, null for a fixed driver model.
  readonly partBytes: readonly number[] | null
}

// A car the viewer is about to draw, with its wheels: a champion's by the code of its body model (such as RRCM), or a design built
// from bricks, which names its chassis. Its driver is asked for apart.
export type CarDrawingRequest = {
  readonly archive: JamArchive
  readonly carCode: string | null
  readonly design: CarDesign | null
  readonly wheels: RacerDrawingPart
}

// A driver the viewer is about to draw, alone or seated in a car.
export type DriverDrawingRequest = {
  readonly archive: JamArchive
  readonly driver: RacerDrawingPart
}

// Where one part of a racer is now, as the viewer has computed it: the part's matrix (frame, position, lean and part scale), whether
// the viewer draws it, and the state the original poses its skeleton with (null: the part has none or rests).
export type RacerPartPose = {
  readonly matrix: Matrix4
  readonly isVisible: boolean
  readonly animationState: SkeletonAnimationState | null
}

export type CarDrawingPose = {
  readonly body: RacerPartPose | null
  readonly wheels: RacerPartPose
  // 1 for a solid car; below 1 for a ghost.
  readonly opacity: number
}

export type DriverDrawingPose = RacerPartPose & {
  readonly opacity: number
}

// What a layer draws in place of a whole car (body, chassis and wheels). Its object stands in the scene the car is in; the viewer calls
// `applyPose` with what it computes for the original's meshes whenever that changes.
export type CarDrawing = {
  readonly object: Object3D
  readonly applyPose: (pose: CarDrawingPose) => void
  readonly dispose: () => void
}

// What a layer draws in place of a driver. `animate` advances the figure's own clock by whole milliseconds when the viewer does not
// pose the skeleton itself.
export type DriverDrawing = {
  readonly object: Object3D
  readonly applyPose: (pose: DriverDrawingPose) => void
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
  // Something to draw in place of a car, complete (never mixed with the original's meshes); null keeps the original's.
  readonly getCarDrawing: (request: CarDrawingRequest) => CarDrawing | null
  // Something to draw in place of a driver, complete; null keeps the original's.
  readonly getDriverDrawing: (request: DriverDrawingRequest) => DriverDrawing | null
  // Something to run before each frame of this race is rendered; null adds nothing.
  readonly getRaceRenderPass: (request: RaceRenderRequest) => RaceRenderPass | null
  // Something to draw in place of the model the original draws for an effect, in that model's frame (the original's units, its scale applied); null keeps the original's.
  readonly getEffectModelDrawing: (request: EffectModelDrawingRequest) => Object3D | null
  // The selections the layer runs with (texture pack, audio pack, bricks), for the notes of a recording.
  readonly getSelections: () => readonly string[]
}
