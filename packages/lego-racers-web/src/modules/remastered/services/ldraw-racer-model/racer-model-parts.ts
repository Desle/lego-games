import { Box3, Group, Vector3 } from 'three'
import type { Object3D } from 'three'
import type { FoundWheel } from './ldraw-racer-model.types.ts'

const WHEEL_CATEGORIES: readonly string[] = ['wheel', 'tyre']
const FIGURE_CATEGORY_PREFIX = 'minifig'
// Two parts of a wheel (a tyre and its rim) have the same centre; two wheels of a car are a stud or more apart.
const SAME_WHEEL_DISTANCE = 12

const getCategory = (object: Object3D): string => {
  const category: unknown = object.userData['category']
  return typeof category === 'string' ? category.toLowerCase() : ''
}

// Takes the wheels and any minifigure out of a parsed LDraw model, by the category the library gives their parts (`Wheel`, `Tyre`,
// `Minifig ...`). The model is the root, at the origin. A wheel's tyre and rim come out together; the figure is only removed: the
// game's driver is drawn from its own part bytes and poses on the game's skeleton.
export const takeWheelsAndFigures = (model: Group): readonly FoundWheel[] => {
  model.updateMatrixWorld(true)
  const parts: Object3D[] = []
  const figureParts: Object3D[] = []
  const visit = (parent: Object3D) => {
    for (const child of parent.children) {
      const category = getCategory(child)
      if (WHEEL_CATEGORIES.includes(category)) parts.push(child)
      else if (category.startsWith(FIGURE_CATEGORY_PREFIX)) figureParts.push(child)
      else visit(child)
    }
  }
  visit(model)
  for (const part of figureParts) part.removeFromParent()
  const wheels: FoundWheel[] = []
  for (const part of parts) {
    const centre = new Box3().setFromObject(part).getCenter(new Vector3())
    const wheel = wheels.find(
      (candidate) => candidate.centre.distanceTo(centre) < SAME_WHEEL_DISTANCE
    )
    const unit = wheel?.unit ?? new Group()
    if (wheel === undefined) wheels.push({ unit, centre })
    unit.attach(part)
  }
  return wheels
}
