import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { DragGuides } from './builder-drag-guides.types.ts'

const GUIDE_COLOR = 0x35d6ff
const TARGET_RADIUS = 3
const ON_TOP = 10

// Drawn over the parts, so the joined connection shows inside a stack and the line through it.
export const createDragGuides = (): DragGuides => {
  const object = new Group()
  const target = new Mesh(
    new SphereGeometry(TARGET_RADIUS, 12, 8),
    new MeshBasicMaterial({ color: GUIDE_COLOR, depthTest: false, transparent: true })
  )
  const line = new Line(
    new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]),
    new LineBasicMaterial({ color: GUIDE_COLOR, depthTest: false, transparent: true, opacity: 0.8 })
  )
  for (const mark of [target, line]) {
    mark.renderOrder = ON_TOP
    mark.visible = false
    mark.raycast = () => undefined
    object.add(mark)
  }
  return {
    object,
    show: (point, guide) => {
      target.visible = point !== null
      if (point !== null) target.position.set(...point)
      line.visible = guide !== null
      if (guide !== null) {
        line.geometry.setFromPoints([new Vector3(...guide.from), new Vector3(...guide.to)])
      }
    },
  }
}
