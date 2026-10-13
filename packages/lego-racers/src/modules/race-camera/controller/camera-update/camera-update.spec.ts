import { CAMERA_PRESETS } from '../../types/camera-presets/camera-presets.ts'
import { CameraMode } from '../../types/camera-mode/camera-mode.ts'
import type { CameraRacerView } from '../../types/race-camera.types.ts'
import {
  attachCamera,
  createCamera,
  placeCameraAtIntroductionPoint,
  placeCameraAtView,
  setCameraLookingBehind,
  setCameraPreset,
} from '../camera-setup/camera-setup.ts'
import { getCameraView, updateCamera } from './camera-update.ts'

// A car at (100, 50, 3) pointing along +y with its up axis along +z, not steering.
const racer: CameraRacerView = {
  position: { x: 100, y: 50, z: 3 },
  rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1],
  turnRadius: 0,
  forwardSpeed: 0.1,
  isBodyFlagTwoSet: false,
  isFullThrottle: false,
  turboLevel: 0,
}

describe('camera presets', () => {
  it('has the eight rows of the table at 0x004b0328', () => {
    // Arrange / Act
    const distances = CAMERA_PRESETS.map((preset) => preset.distance)

    // Assert
    expect(distances).toEqual([20, 30, 10, 0, 32, 22, 45, 15])
    expect(CAMERA_PRESETS.map((preset) => preset.mode)).toEqual([
      CameraMode.CHASE,
      CameraMode.CHASE,
      CameraMode.CHASE,
      CameraMode.COCKPIT,
      CameraMode.FINISH,
      CameraMode.CHASE,
      CameraMode.CHASE,
      CameraMode.CHASE,
    ])
  })

  it('selects rows 5..7 for the raised offset only below camera number 3', () => {
    // Arrange
    const camera = createCamera()

    // Act
    const raised = setCameraPreset(camera, 1, true)
    const cockpit = setCameraPreset(camera, 3, true)

    // Assert
    expect(raised.distance).toBe(CAMERA_PRESETS[6]?.distance)
    expect(cockpit.mode).toBe(CameraMode.COCKPIT)
  })

  it('stores the pitch sine and cosine and the ease rates of the row', () => {
    // Arrange
    const camera = createCamera()

    // Act
    const chase = setCameraPreset(camera, 0, false)

    // Assert
    expect(chase.pitchSine).toBeCloseTo(Math.sin((5 * Math.PI) / 180), 6)
    expect(chase.heightSine).toBeCloseTo(Math.sin((35 * Math.PI) / 180), 6)
    expect(chase.positionRate).toBeCloseTo(0.036, 6)
    expect(chase.rotationRate).toBeCloseTo(0.012, 6)
    expect(chase.distance).toBe(20)
  })
})

describe('updateCamera', () => {
  it('snaps behind and above the racer on the first update', () => {
    // Arrange
    const camera = attachCamera(createCamera(), racer)

    // Act
    const { view } = updateCamera(camera, racer, 16)

    // Assert
    expect(view.position.x).toBeCloseTo(100, 3)
    expect(view.position.y).toBeLessThan(50)
    expect(view.position.z).toBeGreaterThan(3)
    expect(view.forward.y).toBeGreaterThan(0.9)
  })

  it('keeps the chase distance behind the racer in the plane', () => {
    // Arrange
    const camera = attachCamera(createCamera(), racer)

    // Act
    const { view } = updateCamera(camera, racer, 16)

    // Assert
    const planeDistance = Math.hypot(view.position.x - 100, view.position.y - 50)
    expect(planeDistance).toBeCloseTo(20 * Math.cos((5 * Math.PI) / 180), 2)
  })

  it('eases toward a moved racer instead of jumping after the first update', () => {
    // Arrange
    const first = updateCamera(attachCamera(createCamera(), racer), racer, 16)
    const moved = { ...racer, position: { x: 100, y: 150, z: 3 } }

    // Act
    const second = updateCamera(first.camera, moved, 16)

    // Assert
    expect(second.view.position.y).toBeGreaterThan(first.view.position.y)
    expect(second.view.position.y).toBeLessThan(150 - 10)
  })

  it('does nothing for a zero step unless a snap is waiting', () => {
    // Arrange
    const snapped = updateCamera(attachCamera(createCamera(), racer), racer, 16)

    // Act
    const idle = updateCamera(snapped.camera, racer, 0)

    // Assert
    expect(idle.camera).toBe(snapped.camera)
  })

  it('waits without a racer and asks for a snap', () => {
    // Arrange
    const camera = { ...createCamera(), isSnapRequested: false }

    // Act
    const { camera: waiting } = updateCamera(camera, racer, 16)

    // Assert
    expect(waiting.isSnapRequested).toBe(true)
  })

  it('pulls in at a turbo start and lets the distance out again', () => {
    // Arrange
    const first = updateCamera(attachCamera(createCamera(), racer), racer, 16)
    const turbo = { ...racer, isFullThrottle: true, turboLevel: 1 }

    // Act
    const started = updateCamera(first.camera, turbo, 16)
    const later = Array.from({ length: 200 }).reduce<ReturnType<typeof updateCamera>>(
      (update) => updateCamera(update.camera, turbo, 16),
      started
    )

    // Assert
    expect(started.camera.distanceFactor).toBeLessThan(0)
    expect(later.camera.distanceFactor).toBe(1)
  })

  it('places the cockpit camera above the racer', () => {
    // Arrange
    const cockpit = setCameraPreset(attachCamera(createCamera(), racer), 3, false)

    // Act
    const { view } = updateCamera(cockpit, racer, 16)

    // Assert
    expect(view.position).toEqual({ x: 100, y: 50, z: 13 })
  })

  it('circles to the front of the car during the finish camera', () => {
    // Arrange
    const snapped = updateCamera(attachCamera(createCamera(), racer), racer, 16)
    const finish = setCameraPreset(snapped.camera, 4, false)

    // Act
    const ended = Array.from({ length: 150 }).reduce<ReturnType<typeof updateCamera>>(
      (update) => updateCamera(update.camera, racer, 16),
      { camera: finish, view: snapped.view }
    )

    // Assert
    expect(ended.camera.modeMilliseconds).toBe(2000)
    expect(ended.view.position.y).toBeGreaterThan(50)
  })
})

describe('getCameraView', () => {
  it('mirrors the eye through the point looked at when looking behind', () => {
    // Arrange
    const snapped = updateCamera(attachCamera(createCamera(), racer), racer, 16)
    const behind = setCameraLookingBehind(snapped.camera, true)

    // Act
    const view = getCameraView(behind)

    // Assert
    expect(view.position.y).toBeGreaterThan(50)
    expect(view.forward.y).toBeLessThan(-0.9)
    expect(view.forward.z).toBeCloseTo(snapped.view.forward.z, 6)
  })
})

describe('the introduction mode', () => {
  const point = { x: 10, y: 20, z: 30 }
  const vectors = [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: -1 },
  ] as const
  const chased = updateCamera(attachCamera(createCamera(), racer), racer, 1).camera
  const introduction = placeCameraAtIntroductionPoint(chased, point, vectors)

  it('starts at the race description point looking along its vectors', () => {
    // Arrange / Act
    const view = getCameraView(introduction)

    // Assert
    expect(introduction.mode).toBe(CameraMode.INTRODUCTION)
    expect(view.position).toEqual(point)
    expect(view.forward).toEqual(vectors[0])
  })

  it('moves 1/2000 of the way to the chase target per millisecond (a step is at most 100)', () => {
    // Arrange
    const target = introduction.targetPosition

    // Act
    const { camera } = updateCamera(introduction, racer, 100)

    // Assert
    expect(camera.position.x).toBeCloseTo(point.x + (target.x - point.x) * 0.05, 3)
    expect(camera.modeMilliseconds).toBe(100)
  })

  it('arrives at the chase target after 2,000 ms and stays', () => {
    // Arrange
    const steps = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
    const arrived = [...steps, ...steps, ...steps].reduce(
      (camera, step) => updateCamera(camera, racer, step).camera,
      introduction
    )

    // Act
    const position = getCameraView(arrived).position

    // Assert
    expect(arrived.modeMilliseconds).toBe(2000)
    expect(position).toEqual(introduction.targetPosition)
  })

  it('takes the released node pose as the start of the ease', () => {
    // Arrange
    const view = {
      position: { x: 1, y: 2, z: 3 },
      forward: { x: 0, y: 2, z: 0 },
      up: { x: 0, y: 1, z: -3 },
    }

    // Act
    const placed = placeCameraAtView(introduction, view)

    // Assert
    expect(placed.position).toEqual(view.position)
    expect(placed.previousPosition).toEqual(view.position)
    expect(placed.basis.slice(6)).toEqual([0, 1, 0])
    expect(placed.basis.slice(3, 6)).toEqual([0, 0, -1])
  })
})
