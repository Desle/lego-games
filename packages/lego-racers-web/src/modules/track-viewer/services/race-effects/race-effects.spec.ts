import { createRace } from '@lego-games/lego-racers/race'
import { getEffectViews } from '@lego-games/lego-racers/race-presentation'
import type { BrickView, EffectViews } from '@lego-games/lego-racers/race-presentation'
import { Group, Matrix4, Mesh, PerspectiveCamera, Scene, Vector3 } from 'three'
import type { BufferAttribute, Object3D } from 'three'
import {
  clearViewerExtensions,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import { getCameraFrustum } from '../race-viewport/camera-frustum.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../port-race/original-game-files.ts'
import { createRaceEffects } from './race-effects.ts'

// The bricks' clips (pubricky, enhabrik) turn them once in 800 ms on the world clock (0x00457900, 0x0045a490): 200 ms is a quarter.
const QUARTER_TURN_MILLISECONDS = 200
const EYE = Object.freeze({ x: 0, y: -12, z: 4 })
const BRICK_CASES = [
  {
    instanceName: 'pubricky',
    brick: { isEnhancement: false, kind: 'projectile', position: { x: 0, y: 0, z: 0 }, scale: 1 },
  },
  {
    instanceName: 'enhabrik',
    brick: { isEnhancement: true, kind: null, position: { x: 0, y: 0, z: 0 }, scale: 1 },
  },
] as const

const getAssets = (): RaceAssets =>
  loadRaceAssets(
    readOriginalJam(),
    { executable: readOriginalExecutable(), tunes: new Map() },
    { raceFolder: 'RACEC0R0' }
  )

const getViews = (assets: RaceAssets, brick: BrickView, clock: number): EffectViews =>
  Object.freeze({
    ...getEffectViews(createRace(assets.definition)),
    effects: [],
    attachments: [],
    bricks: [brick],
    brickClockMilliseconds: clock,
  })

const getFrustum = () => {
  const camera = new PerspectiveCamera(60, 4 / 3, 0.5, 20000)
  camera.position.set(EYE.x, EYE.y, EYE.z)
  camera.up.set(0, 0, 1)
  camera.lookAt(0, 0, 0)
  return getCameraFrustum(camera)
}

const getRounded = (point: Vector3): readonly number[] =>
  point.toArray().map((value) => Number(value.toFixed(3)))

const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

const getHasAncestorNamed = (object: Object3D, name: string): boolean =>
  object.parent !== null &&
  (object.parent.name.toLowerCase() === name || getHasAncestorNamed(object.parent, name))

// The first vertex of the brick's own mesh where its bones put it, drawn or hidden behind a layer's drawing.
const getBrickVertex = (scene: Scene, instanceName: string): Vector3 => {
  scene.updateMatrixWorld(true)
  const meshes: Mesh[] = []
  scene.traverse((child) => {
    if (getIsMesh(child) && getHasAncestorNamed(child, instanceName)) meshes.push(child)
  })
  const mesh = meshes[0]
  if (mesh === undefined) throw new Error(`No ${instanceName} mesh was drawn`)
  const positions = mesh.geometry.getAttribute('position') as BufferAttribute
  return new Vector3().fromBufferAttribute(positions, 0).applyMatrix4(mesh.matrixWorld)
}

// The brick drawn at two clock readings a quarter turn apart: its mesh's vertex, and the world matrix of a layer's drawing.
const getFrames = (assets: RaceAssets, caseIndex: number, drawing: Group | null) => {
  const { brick, instanceName } = BRICK_CASES[caseIndex] ?? BRICK_CASES[0]
  const scene = new Scene()
  const effects = createRaceEffects(scene, assets.effectModels)
  const frustum = getFrustum()
  const frames = [0, QUARTER_TURN_MILLISECONDS].map((clock) => {
    effects.update(getViews(assets, brick, clock), EYE, [], frustum)
    return {
      vertex: getBrickVertex(scene, instanceName),
      drawingMatrix: drawing === null ? null : drawing.matrixWorld.clone(),
    }
  })
  effects.dispose()
  return frames
}

describe.skipIf(!getIsOriginalGamePresent())('the bricks on the track', () => {
  afterEach(() => {
    clearViewerExtensions()
  })

  it.each([0, 1])('turns brick case %i with its clip (classic)', (caseIndex) => {
    // Arrange
    const assets = getAssets()

    // Act
    const [first, second] = getFrames(assets, caseIndex, null)

    // Assert
    expect(getRounded(second?.vertex ?? new Vector3())).not.toEqual(
      getRounded(first?.vertex ?? new Vector3())
    )
  })

  it.each([0, 1])('turns a layer drawing of brick case %i as its mesh turns', (caseIndex) => {
    // Arrange
    const assets = getAssets()
    const drawing = new Group()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getEffectModelDrawing: () => drawing })

    // Act
    const [first, second] = getFrames(assets, caseIndex, drawing)

    // Assert: what the drawing moved between the frames carries the mesh's vertex from the first frame onto the second
    const firstMatrix = first?.drawingMatrix ?? new Matrix4()
    const secondMatrix = second?.drawingMatrix ?? new Matrix4()
    const moved = (first?.vertex ?? new Vector3())
      .clone()
      .applyMatrix4(firstMatrix.clone().invert())
      .applyMatrix4(secondMatrix)
    expect(getRounded(second?.vertex ?? new Vector3())).not.toEqual(
      getRounded(first?.vertex ?? new Vector3())
    )
    expect(getRounded(moved)).toEqual(getRounded(second?.vertex ?? new Vector3()))
  })
})
