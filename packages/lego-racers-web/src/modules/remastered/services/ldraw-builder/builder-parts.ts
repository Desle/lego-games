import { Box3, Color, Group, Matrix4, MeshBasicMaterial } from 'three'
import type { Material, Object3D } from 'three'
import { getIsMesh, holdPreparedModel } from '@lego-games/ldraw/geometry'
import { LDrawDetail } from '@lego-games/ldraw/library'
import { formatPartLine } from '@lego-games/ldraw/building'
import type { BuilderBox, BuilderPartLine } from './ldraw-builder.types.ts'
import type { PartTemplate, PartTemplates } from './builder-parts.types.ts'

const IDENTITY_ROTATION: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const GHOST_OPACITY = 0.55
const GHOST_FALLBACK_COLOR = 0xffffff

const getKey = (partName: string, colorCode: number): string =>
  `${partName.toLowerCase()}|${String(colorCode)}`

const getMeshBox = (object: Object3D): BuilderBox | null => {
  object.updateMatrixWorld(true)
  const box = new Box3()
  object.traverse((child) => {
    if (getIsMesh(child)) box.expandByObject(child)
  })
  return box.isEmpty()
    ? null
    : Object.freeze({
        minimum: [box.min.x, box.min.y, box.min.z] as const,
        maximum: [box.max.x, box.max.y, box.max.z] as const,
      })
}

const createTemplate = async (
  partName: string,
  colorCode: number,
  detail: LDrawDetail = LDrawDetail.HIGH
): Promise<PartTemplate | null> => {
  const hold = holdPreparedModel(
    formatPartLine({ colorCode, position: [0, 0, 0], rotation: IDENTITY_ROTATION, partName }),
    detail
  )
  const { model } = await hold.prepared
  const box = getMeshBox(model)
  if (box === null) hold.release()
  return box === null ? null : Object.freeze({ object: model, box, release: hold.release })
}

// A part drawn once and thrown away (a palette picture): plain studs, and the caller releases it, so browsing thousands of parts keeps
// only the last few.
export const createThrowawayTemplate = (
  partName: string,
  colorCode: number
): Promise<PartTemplate | null> =>
  createTemplate(partName, colorCode, LDrawDetail.LOW).catch(() => null)

// Each part in each colour is prepared once (and kept for the page); placed parts are copies that share its geometry and materials.
export const createPartTemplates = (): PartTemplates => {
  const pending = new Map<string, Promise<PartTemplate | null>>()
  const loaded = new Map<string, PartTemplate | null>()
  const load = (partName: string, colorCode: number): Promise<PartTemplate | null> => {
    const key = getKey(partName, colorCode)
    const existing = pending.get(key)
    if (existing !== undefined) return existing
    const promise = createTemplate(partName, colorCode)
      .catch(() => null)
      .then((template) => {
        loaded.set(key, template)
        return template
      })
    pending.set(key, promise)
    return promise
  }
  return {
    load,
    getLoaded: (partName, colorCode) => loaded.get(getKey(partName, colorCode)),
  }
}

export const getPartMatrix = (part: BuilderPartLine): Matrix4 => {
  const [x, y, z] = part.position
  const getEntry = (row: number, column: number) =>
    part.rotation[row * 3 + column] ?? (row === column ? 1 : 0)
  const getRow = (row: number) => [getEntry(row, 0), getEntry(row, 1), getEntry(row, 2)] as const
  return new Matrix4().set(...getRow(0), x, ...getRow(1), y, ...getRow(2), z, 0, 0, 0, 1)
}

export const createPartInstance = (template: PartTemplate, part: BuilderPartLine): Group => {
  const instance = template.object.clone()
  instance.matrixAutoUpdate = false
  instance.matrix.copy(getPartMatrix(part))
  return instance
}

const getMaterialColor = (material: Material | Material[]): Color => {
  const first = Array.isArray(material) ? material[0] : material
  return first !== undefined && 'color' in first && first.color instanceof Color
    ? first.color
    : new Color(GHOST_FALLBACK_COLOR)
}

// The part under the cursor before it is placed: its colour, see-through, without edges.
export const createGhostInstance = (template: PartTemplate, part: BuilderPartLine): Group => {
  const ghost = createPartInstance(template, part)
  const children: Object3D[] = []
  ghost.traverse((child) => void children.push(child))
  for (const child of children) {
    if (getIsMesh(child)) {
      child.material = new MeshBasicMaterial({
        color: getMaterialColor(child.material),
        transparent: true,
        opacity: GHOST_OPACITY,
        depthWrite: false,
      })
      child.raycast = () => undefined
    } else if (child !== ghost && !(child instanceof Group)) {
      child.visible = false
    }
  }
  return ghost
}
