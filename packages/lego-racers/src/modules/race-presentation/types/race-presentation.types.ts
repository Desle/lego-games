import type { CameraState, CameraView } from '../../race-camera/index.ts'
import type { MusicCue, SoundRequest } from '../../race-audio/index.ts'
import type {
  HudFrame,
  HudImageSize,
  HudLayout,
  HudMeasureText,
  HudState,
} from '../../race-hud/index.ts'
import type { Matrix3, Vector3 } from '../../simulation-math/index.ts'
import type { RacePhaseValue } from '../../race/index.ts'

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
  readonly isPlayerPowerSliding: boolean
}

// What the HUD needs from the renderer: the strings, the images and the text measure.
export type HudContext = {
  readonly layout: HudLayout
  readonly getString: (stringId: number) => string
  readonly imageNames: readonly string[]
  readonly getImageSize: (imageName: string) => HudImageSize | null
  readonly measureText: HudMeasureText
}

export type RacePresentationFrame = {
  readonly presentation: RacePresentation
  readonly cameraView: CameraView
  // null in the introduction and the results, when the original draws no HUD.
  readonly hudFrame: HudFrame | null
  readonly sounds: readonly SoundRequest[]
  // The music track to switch to this frame, if any.
  readonly music: MusicCue | null
}

// A racer on the track: where its display frame is.
export type RacerPose = {
  readonly racerIndex: number
  readonly position: Vector3
  readonly rotation: Matrix3
  readonly isPlayer: boolean
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
