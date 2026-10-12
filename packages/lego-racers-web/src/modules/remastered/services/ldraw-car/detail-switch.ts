import { Object3D, PerspectiveCamera, Vector3 } from 'three'
import type { Camera } from 'three'

// A stud is 12 LDraw units across. The logo on it reads only when the stud is about this many CSS pixels wide, so a model draws its
// logo studs only as near to the camera as that, however the window and the field of view make it (a phone's small screen sooner than
// a monitor's).
const STUD_DIAMETER = 12
const LOGO_VISIBLE_PIXELS = 14
const DEFAULT_FIELD_OF_VIEW = 65
const PREFETCH_DISTANCE_FACTOR = 1.5

// The distance, in the model's own units, up to which the stud logos are drawn.
export const getHighDetailDistance = (viewportHeight: number, fieldOfViewDegrees: number): number =>
  (STUD_DIAMETER * (viewportHeight / 2)) /
  (Math.tan((fieldOfViewDegrees * Math.PI) / 360) * LOGO_VISIBLE_PIXELS)

const EDGE_FLAG = 'isDetailEdge'

let isShadowRenderActive = false

// The high models are built one after the other, with a turn of the event loop between, so a pack of cars coming near together
// (the start grid) does not stall a frame for all of them at once.
let highBuilds: Promise<unknown> = Promise.resolve()

const enqueueHighBuild = (build: () => Promise<Object3D>): Promise<Object3D> => {
  const result = highBuilds
    .then(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
    .then(build)
  highBuilds = result.catch(() => undefined)
  return result
}

// The shadow pass says when it draws, so models show their low resolution without edge lines in the shadow map.
export const setIsShadowRenderActive = (isActive: boolean) => {
  isShadowRenderActive = isActive
}

const cameraPosition = new Vector3()
const modelPosition = new Vector3()

const setVisible = (object: Object3D, isVisible: boolean) => {
  // eslint-disable-next-line no-param-reassign -- the switch shows one level of detail and hides the other
  object.visible = isVisible
}

// Marks the edge lines of a level, so the shadow pass can leave them out.
export const markDetailEdges = (level: Object3D) =>
  level.traverse((child) => {
    if (Reflect.get(child, 'isLineSegments') === true)
      Object.assign(child.userData, { [EDGE_FLAG]: true })
  })

// A model in two resolutions, drawn one at a time by the distance to the camera (a three.js `LOD` does the same, but cannot measure in
// the model's own units, which the cars are drawn in whatever the race scales them to). The low one is there first; the high one is
// built only when the camera comes near (a logo stud model costs twenty times the parsing, the triangles and the memory), a little
// before it is drawn, and is drawn only up close.
export class DetailSwitch extends Object3D {
  readonly isLOD = true
  // eslint-disable-next-line @typescript-eslint/naming-convention -- three.js reads this name to call `update` while rendering
  autoUpdate = true
  isHighShown = false
  private low: Object3D | null = null
  private high: Object3D | null = null
  private highLoader: (() => Promise<Object3D>) | null = null
  private highRequest: Promise<void> | null = null

  setHighLoader(loader: () => Promise<Object3D>) {
    this.highLoader = loader
  }

  // Builds the high model if it is not built yet: when the camera is near, or when a picture of the model is wanted.
  requestHigh(): Promise<void> {
    if (this.highRequest === null) {
      const loader = this.highLoader
      this.highRequest =
        loader === null
          ? Promise.resolve()
          : enqueueHighBuild(loader).then((level) => this.setHigh(level))
    }
    return this.highRequest
  }

  setLow(level: Object3D) {
    this.low = level
    this.add(level)
  }

  setHigh(level: Object3D) {
    this.high = level
    this.add(level)
  }

  getLevels(): readonly (Object3D | null)[] {
    return [this.low, this.high]
  }

  update(camera: Camera) {
    cameraPosition.setFromMatrixPosition(camera.matrixWorld)
    modelPosition.setFromMatrixPosition(this.matrixWorld)
    const distance = cameraPosition.distanceTo(modelPosition) / this.matrixWorld.getMaxScaleOnAxis()
    const highDistance = getHighDetailDistance(
      globalThis.innerHeight,
      camera instanceof PerspectiveCamera ? camera.fov : DEFAULT_FIELD_OF_VIEW
    )
    if (!isShadowRenderActive && distance < highDistance * PREFETCH_DISTANCE_FACTOR) {
      this.requestHigh().catch((error: unknown) =>
        console.error('The LDraw library could not build the high detail', error)
      )
    }
    this.isHighShown = this.high !== null && !isShadowRenderActive && distance < highDistance
    if (this.high !== null) setVisible(this.high, this.isHighShown)
    if (this.low !== null) setVisible(this.low, !this.isHighShown)
    this.low?.traverse((child) => {
      if (child.userData[EDGE_FLAG] === true) setVisible(child, !isShadowRenderActive)
    })
  }
}
