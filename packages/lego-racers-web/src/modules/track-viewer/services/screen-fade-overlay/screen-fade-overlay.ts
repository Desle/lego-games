import type { ScreenFadeView } from '@lego-games/lego-racers/race-presentation'
import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene } from 'three'
import type { ScreenFadeOverlay } from './screen-fade-overlay.types.ts'

const COLOUR_LEVELS = 255
// A plane of two units on a camera that sees two units each way covers the whole surface.
const PLANE_SIZE = 2
const CAMERA_EXTENT = 1

// The screen fades (LEGORacers.exe 0x004905e0): a quad over the whole view in one colour, blended by its alpha, drawn
// after everything else without the depth test. Direct3D has no colour management, so the colour is used as stored.
export const createScreenFadeOverlay = (): ScreenFadeOverlay => {
  const scene = new Scene()
  const camera = new OrthographicCamera(
    -CAMERA_EXTENT,
    CAMERA_EXTENT,
    CAMERA_EXTENT,
    -CAMERA_EXTENT,
    0,
    1
  )
  const geometry = new PlaneGeometry(PLANE_SIZE, PLANE_SIZE)
  const quads: Mesh<PlaneGeometry, MeshBasicMaterial>[] = []
  const getQuad = (index: number): Mesh<PlaneGeometry, MeshBasicMaterial> => {
    const existing = quads[index]
    if (existing !== undefined) return existing
    const material = new MeshBasicMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    const quad = new Mesh(geometry, material)
    quad.frustumCulled = false
    scene.add(quad)
    quads.push(quad)
    return quad
  }
  return Object.freeze({
    scene,
    camera,
    update: (fades: readonly ScreenFadeView[]) => {
      const drawn = fades.flatMap((fade) => Array.from({ length: fade.drawCount }, () => fade))
      drawn.forEach((fade, index) => {
        const quad = getQuad(index)
        quad.material.color.setRGB(
          fade.red / COLOUR_LEVELS,
          fade.green / COLOUR_LEVELS,
          fade.blue / COLOUR_LEVELS
        )
        quad.material.opacity = fade.alpha / COLOUR_LEVELS
        quad.visible = true
      })
      for (const unused of quads.slice(drawn.length)) unused.visible = false
    },
    dispose: () => {
      geometry.dispose()
      for (const quad of quads) quad.material.dispose()
    },
  })
}
