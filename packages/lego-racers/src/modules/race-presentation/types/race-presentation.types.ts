import type { BrickBase } from '../../power-ups/index.ts'
import type { CameraState, CameraView } from '../../race-camera/index.ts'
import type {
  EngineLoop,
  EngineSoundState,
  MusicCue,
  SoundRequest,
} from '../../race-audio/index.ts'
import type {
  HudFrame,
  HudImageSize,
  HudLayout,
  HudMeasureText,
  HudState,
} from '../../race-hud/index.ts'
import type { SkeletonAnimationState } from '../../skeletal-animation/index.ts'
import type { VehicleSkids } from '../../racer/index.ts'
import type { DecalLimits, DecalPlacement } from '../../decal/index.ts'
import type { ColourShift } from '../../racer/index.ts'
import type { Matrix3, Vector3 } from '../../simulation-math/index.ts'
import type { RacePhaseValue, RaceState } from '../../race/index.ts'
import type { GhostRunSelection } from '../../ghost/index.ts'

// A ghost car of a time trial (FUN_00422960): the champion's, drawn from GHOST.WDB, or the session's best run, drawn with
// the player's own car. All three parts take the run's one orientation; the driver sits at the seat point carried by it.
export type GhostCar = {
  readonly kind: GhostRunSelection
  readonly position: Vector3
  readonly rotation: Matrix3
  readonly driverPosition: Vector3
  // The integer FUN_00422960 stores as the wheels' animation rate (+0xb8).
  readonly speed: number
}

export type GhostCarsStep = {
  // The race with the ghost's playback flags moved on (a run whose last sample has passed stops being drawn).
  readonly raceState: RaceState
  readonly cars: readonly GhostCar[]
}

// Everything the screen and the speakers show that the simulation does not keep: the player's camera and HUD, the
// turbo level the camera reads, and the previous frame's phase and bindings for edge detection.
export type RacePresentation = {
  readonly playerRacerIndex: number
  // The entries of the race's music list (`LEGOMSC`, seven in Royal Knights Raceway).
  readonly musicListCount: number
  readonly camera: CameraState
  readonly hud: HudState
  // Racer +0xd68 of the player's racer, from the last turbo start.
  readonly turboLevel: number
  // Racer +0xdb8: which of the four player cameras is selected.
  readonly cameraNumber: number
  // Racer flag 0x400 and not 0x1000 (0x0043a390): the camera binding works from the countdown until the finish.
  readonly isCameraSwitchEnabled: boolean
  readonly previousPhase: RacePhaseValue
  readonly isChangeCameraHeld: boolean
  // The last frame drew the warp (0x0045d940 sets the camera's snap flag, 0x0043a3e0, on every such draw).
  readonly isWarpDrawn: boolean
  readonly isPlayerPowerSliding: boolean
  // Racer +0xd24..+0xd30 and the loops' playing flags (0x00437d40), one per racer.
  readonly engineSounds: readonly EngineSoundState[]
}

// What the HUD needs from the renderer: the strings, the images and the text measure.
export type HudContext = {
  readonly layout: HudLayout
  readonly getString: (stringId: number) => string
  readonly imageNames: readonly string[]
  readonly getImageSize: (imageName: string) => HudImageSize | null
  readonly measureText: HudMeasureText
  // The race description's display bounds (keyword 0x46) for the minimap, or null; whether the track is mirrored; and the
  // image database name of the map picture (null when the world has none).
  readonly displayBounds: readonly [number, number, number, number] | null
  readonly isMirrored: boolean
  readonly mapImageName: string | null
}

// One racer's looped engine and skid sounds this frame, with where the racer is (the sound objects' +0x18 and +0x24).
export type RacerEngineLoops = {
  readonly racerIndex: number
  readonly position: Vector3
  readonly velocity: Vector3
  readonly loops: readonly EngineLoop[]
}

export type RacePresentationFrame = {
  readonly presentation: RacePresentation
  readonly cameraView: CameraView
  // The warp's tunnel scene while the player is carried (0x0045d940), else null.
  readonly warpView: WarpView | null
  // null in the introduction and the results, when the original draws no HUD.
  readonly hudFrame: HudFrame | null
  readonly sounds: readonly SoundRequest[]
  readonly engineLoops: readonly RacerEngineLoops[]
  // The music track to switch to this frame, if any.
  readonly music: MusicCue | null
}

// What the player's warp draws instead of the track: the tunnel animated for `tunnelMilliseconds`, the car at the origin
// (`pose`) and the camera that follows it.
export type WarpView = {
  readonly tunnelMilliseconds: number
  readonly pose: RacerPose
  readonly cameraView: CameraView
}

// Where the three drawn parts of a car have their bounding sphere centres in the world (0x0040e270 reads them with
// FUN_00411c60): the wheels, the car model and the driver.
export type RacerPartCentres = {
  readonly wheels: Vector3
  readonly body: Vector3 | null
  readonly driver: Vector3
}

// The car's blob shadow (0x0043fa50): a decal projected straight down onto the track's receiving faces.
export type RacerShadow = {
  readonly placement: DecalPlacement
}

// A racer on the track: where its display frame is, and what hangs on it. The wheels (a skeleton instance) sit in the
// display frame; the car model sits at the same position with the leaned rotation of vehicle +0x3c (0x0043e740); the
// driver sits at `driverPosition` with the car model's rotation (vehicle +0x48).
export type RacerPose = {
  readonly racerIndex: number
  readonly position: Vector3
  readonly rotation: Matrix3
  readonly isPlayer: boolean
  readonly bodyRotation: Matrix3
  readonly driverPosition: Vector3
  // The bones of the wheels and of the driver: the figures' clips as the pose sampling reads them.
  readonly wheelAnimation: SkeletonAnimationState
  readonly driverAnimation: SkeletonAnimationState
  // The colour shift a track event put on the racer's models (0x004400a0), or null.
  readonly colourShift: ColourShift | null
  // Where the parts' spheres are, for the distance cut; null in the warp, where the camera stays beside the car.
  readonly partCentres: RacerPartCentres | null
  // The shadow the car casts, drawn when the camera is within the figure's draw distance; null while the racer is off the
  // track for a warp (0x0043dbb0 sets the parts' draw distance to -1 until the landing 0x0043db60) or in the warp's own draw.
  readonly shadow: RacerShadow | null
  // The vehicle's skid marks: the last step's wheels and the trails to let go (0x0043f1e0).
  readonly skids: VehicleSkids
  // The racer is off the track (racer flag 0x10): its parts are not drawn there either.
  readonly isOffTrack: boolean
}

// What the frame's race events change in the presentation.
export type PresentationEdits = {
  readonly camera: CameraState
  readonly hud: HudState
  readonly cameraNumber: number
  readonly isCameraSwitchEnabled: boolean
  readonly music: MusicCue | null
}

export type RacePresentationStart = {
  readonly presentation: RacePresentation
  readonly music: MusicCue
}

// What the race draws of a moving effect: which one, where, and the way it points (null when it has no direction).
export type EffectView = {
  // The power-up effect kind: `rocket`, `barrel`, `cannon`, `grapple`, `magnet`, ...
  readonly kind: string
  readonly position: Vector3
  readonly heading: Vector3 | null
  // The missile figure's frame (0x00456db0, 0x004568f0) and its clip: the rocket's number (0 to 2) is the clip of its
  // launch animation, which has played `launchMilliseconds` while `isLaunching`. Null, 0, false and 0 for the others.
  readonly rotation: Matrix3 | null
  readonly rocketIndex: number
  readonly isLaunching: boolean
  readonly launchMilliseconds: number
}

// An explosion pool member that is growing or fading: where, and the frame scale the engine gives it (0x00410f10).
export type ExplosionView = {
  readonly isSpiked: boolean
  readonly position: Vector3
  readonly scale: number
  // Whether it is a ground burst's scar fading rather than the blast growing.
  readonly isFading: boolean
}

// A brick on the track: where, how large it is drawn (the state machine's scale: growing in, shrinking after a collect)
// and which kind it is. The bricks all turn about the vertical axis by the power-up system's spin angle.
export type BrickView = {
  readonly isEnhancement: boolean
  // The power-up brick's kind (1 projectile, 2 shield, 3 turbo, 4 hazard); null for an enhancement brick.
  readonly kind: string | null
  readonly position: Vector3
  readonly scale: number
}

// What the drawing of a brick reads of either brick class.
export type DrawnBrick = BrickBase & { readonly kind?: string }

// A decal the effects lay on the track (oil slick, explosion scar): the picture's material, where it is placed, how many
// triangles it may hold and the alpha it is drawn with (null: opaque).
export type DecalView = {
  readonly imageName: string
  readonly placement: DecalPlacement
  readonly limits: DecalLimits
  readonly alpha: number | null
}

// A shield or turbo effect hanging on a racer: its kind and level, the racer, its state (2, 3 or 4) with the milliseconds
// left in it, and the milliseconds its figures' animation has run in that state.
export type AttachmentView = {
  readonly kind: string
  readonly level: number
  readonly racerIndex: number
  readonly state: AttachmentState
  readonly timerMilliseconds: number
  readonly elapsedMilliseconds: number
  // The figure's scale (+0x58): 1, except the warp portal's, which follows the fade table (0x0045dbe0).
  readonly scale: number
}

export type AttachmentState = 'starting' | 'active' | 'ending'

// A camera-facing picture an effect draws (the cannon ball is one): its material, centre and size in the world.
export type SpriteView = {
  readonly materialName: string
  readonly position: Vector3
  readonly width: number
  readonly height: number
}

export type EffectViews = {
  readonly sprites: readonly SpriteView[]
  readonly attachments: readonly AttachmentView[]
  readonly bricks: readonly BrickView[]
  readonly spinAngle: number
  readonly effects: readonly EffectView[]
  readonly explosions: readonly ExplosionView[]
  readonly decals: readonly DecalView[]
}
