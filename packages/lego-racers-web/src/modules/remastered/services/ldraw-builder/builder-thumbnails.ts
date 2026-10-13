import { Box3, Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import { createStudioLights } from '../ldraw-car/ldraw-plastic.ts'
import { createPartInstance, createThrowawayTemplate, disposeTemplate } from './builder-parts.ts'
import type { BuilderThumbnails } from './builder-thumbnails.types.ts'

const THUMBNAIL_PIXELS = 128
const FIELD_OF_VIEW = 30
const FRAME_MARGIN = 1.15
const VIEW_DIRECTION = new Vector3(0.75, -1, 0.8).normalize()
const IDENTITY_ROTATION: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]

// Palette pictures: each part in a colour is drawn once on a small canvas of its own and kept as a data URL for the page's life.
export const createBuilderThumbnails = (): BuilderThumbnails => {
  const canvas = document.createElement('canvas')
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setSize(THUMBNAIL_PIXELS, THUMBNAIL_PIXELS, false)
  renderer.setClearAlpha(0)
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 1000)
  camera.up.set(0, 0, 1)
  const frame = new Group()
  frame.matrixAutoUpdate = false
  frame.matrix.copy(LDRAW_TO_STUDS)
  const scene = new Scene()
  scene.add(createStudioLights(), frame)
  const drawn = new Map<string, Promise<string | null>>()
  let queue: Promise<unknown> = Promise.resolve()

  const draw = async (partName: string, colorCode: number): Promise<string | null> => {
    const template = await createThrowawayTemplate(partName, colorCode)
    if (template === null) return null
    frame.clear()
    frame.add(
      createPartInstance(template, {
        partName,
        colorCode,
        position: [0, 0, 0],
        rotation: IDENTITY_ROTATION,
      })
    )
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(frame)
    const centre = box.getCenter(new Vector3())
    const radius = Math.max(box.getSize(new Vector3()).length() / 2, 0.01)
    const distance = (radius * FRAME_MARGIN) / Math.tan((FIELD_OF_VIEW * Math.PI) / 360)
    camera.position.copy(centre).addScaledVector(VIEW_DIRECTION, distance)
    camera.near = distance / 100
    camera.far = distance * 10
    camera.updateProjectionMatrix()
    camera.lookAt(centre)
    renderer.render(scene, camera)
    frame.clear()
    disposeTemplate(template)
    return canvas.toDataURL('image/png')
  }

  return {
    // A picture no longer on screen when its turn comes (the search changed) is skipped, and drawn again if asked again.
    getThumbnail: (partName, colorCode, getIsWanted) => {
      const key = `${partName.toLowerCase()}|${String(colorCode)}`
      const existing = drawn.get(key)
      if (existing !== undefined) return existing
      const next = queue
        .then(() => {
          if (getIsWanted()) return draw(partName, colorCode)
          drawn.delete(key)
          return null
        })
        .catch(() => null)
      queue = next
      drawn.set(key, next)
      return next
    },
  }
}
