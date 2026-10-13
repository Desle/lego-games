import { Box3, Group, Vector3 } from 'three'
import type { Object3D } from 'three'
import { disposeObject } from '../ldraw-racer/dispose-object.ts'
import type { FoundWheel } from './ldraw-racer-model.types.ts'

const WHEEL_CATEGORIES: readonly string[] = ['wheel', 'tyre']
const FIGURE_CATEGORY = 'minifig'
// The minifigure's own body by part number (and the older numbers the library moved them from), prints and assemblies included:
// head, torso (with arms and hands), hips, legs, wooden leg, arms, hands.
const FIGURE_BODY_PART =
  /^(?:3626|973|76382|16360|3815|970|3816|971|3817|972|2532|3818|982|3819|981|3820|983)(?:[a-z].*)?\.dat$/i
// A worn or held part touches its body part; the margin (LDraw units) lets a hat resting on the head count.
const WORN_PART_MARGIN = 1
// Two parts of a wheel (a tyre and its rim) have the same centre; two wheels of a car are a stud or more apart.
const SAME_WHEEL_DISTANCE = 12

const getIsFigureBodyPart = (object: Object3D): boolean => {
  const fileName: unknown = object.userData['fileName']
  return typeof fileName === 'string' && FIGURE_BODY_PART.test(fileName.split('/').at(-1) ?? '')
}

const getCategory = (object: Object3D): string => {
  const category: unknown = object.userData['category']
  return typeof category === 'string' ? category.toLowerCase() : ''
}

// Gives the wheels found in the low resolution model the parts of the same wheels found in the high one (the units stay where they are
// drawn: only what they hold changes), nearest first. A wheel has no studs, so its high resolution is drawn at any distance.
export const upgradeWheels = (found: readonly FoundWheel[], detailed: readonly FoundWheel[]) => {
  for (const wheel of detailed) {
    const target = found.find(
      (candidate) => candidate.centre.distanceTo(wheel.centre) < SAME_WHEEL_DISTANCE
    )
    if (target === undefined) continue
    disposeObject(target.unit)
    target.unit.clear()
    target.unit.add(...wheel.unit.children)
  }
}

// The parts a car body loses to its own drawings: the wheels (`Wheel`, `Tyre`: the wheels are drawn apart) and a minifigure (the game's
// driver is drawn from its own part bytes). The figure is found by its body's part numbers (head, torso, hips, legs, arms, hands: the
// library files them without a category of their own, so the loader names none) and what it wears or holds: a part filed under
// `Minifig ...` (the loader keeps only that first word, for headwear and spears alike) goes with the figure only when it touches a
// body part; anywhere else on the car (a spear on the bonnet) it is the car's. Each part is the outermost object of its kind.
export const getPartsTakenFromCarBody = (model: Object3D): ReadonlySet<Object3D> => {
  model.updateMatrixWorld(true)
  const wheelParts: Object3D[] = []
  const bodyParts: Object3D[] = []
  const figureCategoryParts: Object3D[] = []
  const visit = (parent: Object3D) => {
    for (const child of parent.children) {
      const category = getCategory(child)
      if (WHEEL_CATEGORIES.includes(category)) wheelParts.push(child)
      else if (getIsFigureBodyPart(child)) bodyParts.push(child)
      else if (category === FIGURE_CATEGORY) figureCategoryParts.push(child)
      else visit(child)
    }
  }
  visit(model)
  const bodyBounds = bodyParts.map((part) =>
    new Box3().setFromObject(part).expandByScalar(WORN_PART_MARGIN)
  )
  const wornParts = figureCategoryParts.filter((part) => {
    const bounds = new Box3().setFromObject(part)
    return bodyBounds.some((body) => body.intersectsBox(bounds))
  })
  return new Set([...wheelParts, ...bodyParts, ...wornParts])
}

// Takes the wheels and any minifigure out of a parsed LDraw model (`getPartsTakenFromCarBody`). The model is the root, at the
// origin. A wheel's tyre and rim come out together; the figure is only removed.
export const takeWheelsAndFigures = (model: Group): readonly FoundWheel[] => {
  const taken = getPartsTakenFromCarBody(model)
  const parts = [...taken].filter((part) => WHEEL_CATEGORIES.includes(getCategory(part)))
  for (const part of taken) if (!parts.includes(part)) part.removeFromParent()
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
