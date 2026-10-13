import { Mesh, Vector3 } from 'three'
import type { Material, Object3D } from 'three'
import { DetailSwitch } from '../ldraw-car/detail-switch.ts'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { LDrawDetail } from '../ldraw-library/ldraw-library-loader.types.ts'
import { getPartsTakenFromCarBody } from '../ldraw-racer-model/racer-model-parts.ts'
import { PartLoss } from './hd-coverage.types.ts'
import type { ModelPartFinding, ModelPartLine } from './hd-coverage.types.ts'

const PART_LINE = /^\s*1\s+(\S+)(?:\s+\S+){12}\s+(\S+\.dat)\s*$/i
const FILE_LINE = /^\s*0\s+FILE\s/i
// A part's vertex is drawn when the drawing has a vertex this near (LDraw units); a part is drawn when this share of its vertices are.
const MATCH_TOLERANCE_LDRAW_UNITS = 0.05
const MATCHED_SHARE = 0.5
const NEIGHBOUR_OFFSETS: readonly number[] = [-1, 0, 1]

// The parts the main file of a model places itself (`1 <colour> <matrix> <part>.dat`), with their line numbers; sub-models and the
// chassis recipe it refers to are drawn and checked as their own files.
export const getModelPartLines = (text: string): readonly ModelPartLine[] => {
  const lines = text.split('\n')
  const lastMainLine = lines.findIndex((line, index) => index > 0 && FILE_LINE.test(line))
  return lines
    .slice(0, lastMainLine === -1 ? lines.length : lastMainLine)
    .flatMap((line, index): readonly ModelPartLine[] => {
      const match = PART_LINE.exec(line)
      return match === null
        ? []
        : [
            {
              lineNumber: index + 1,
              color: match[1] ?? '',
              part: match[2] ?? '',
              text: line.trim(),
            },
          ]
    })
}

const getIsMaterialShown = (material: Material | readonly Material[]): boolean =>
  (Array.isArray(material) ? material : [material]).some(
    (entry: Material) => entry.visible && entry.opacity > 0
  )

const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

const getIsShownInWorld = (object: Object3D): boolean => {
  let current: Object3D | null = object
  while (current !== null) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

// A set of points matched within a tolerance: each point is kept in the cell of a grid the size of the tolerance, and looked for in its
// own cell and the 26 around it.
const createPointSet = (tolerance: number) => {
  const cells = new Set<string>()
  const getCell = (value: number) => Math.round(value / tolerance)
  const getKey = (x: number, y: number, z: number) => `${String(x)},${String(y)},${String(z)}`
  return {
    add: (point: Vector3) =>
      cells.add(getKey(getCell(point.x), getCell(point.y), getCell(point.z))),
    has: (point: Vector3): boolean => {
      const [x, y, z] = [getCell(point.x), getCell(point.y), getCell(point.z)]
      for (const offsetX of NEIGHBOUR_OFFSETS)
        for (const offsetY of NEIGHBOUR_OFFSETS)
          for (const offsetZ of NEIGHBOUR_OFFSETS)
            if (cells.has(getKey(x + offsetX, y + offsetY, z + offsetZ))) return true
      return false
    },
  }
}

const forEachVertex = (root: Object3D, visit: (mesh: Mesh, position: Vector3) => void) =>
  root.traverse((object) => {
    if (!getIsMesh(object)) return
    const attribute = object.geometry.getAttribute('position')
    for (let index = 0; index < attribute.count; index++) {
      visit(
        object,
        new Vector3().fromBufferAttribute(attribute, index).applyMatrix4(object.matrixWorld)
      )
    }
  })

// Every part line of a model's main file must end up as drawn geometry where the file puts it: the file's parts are parsed alone (the
// same library and detail) and carried into the drawn body's frame, and most of each part's triangle vertices must be vertices the
// drawing draws (the merge keeps every vertex where it was). Wheels and the figure's own parts are taken out on purpose (the wheels
// are their own drawing, the driver is). A lost part is `invisible` when its vertices are there but hidden or fully transparent, else
// `dropped` (not drawn, or drawn somewhere else).
export const checkModelParts = async (
  model: string,
  text: string,
  drawing: Object3D
): Promise<readonly ModelPartFinding[]> => {
  const lines = getModelPartLines(text)
  const body = drawing
    .getObjectsByProperty('isLOD', true)
    .find((object): object is DetailSwitch => object instanceof DetailSwitch)
  const getFinding = (line: ModelPartLine, loss: PartLoss): ModelPartFinding => ({
    model,
    lineNumber: line.lineNumber,
    part: line.part,
    text: line.text,
    loss,
  })
  if (body === undefined) return lines.map((line) => getFinding(line, PartLoss.DROPPED))
  const parsed = await parseLDrawModel(lines.map((line) => line.text).join('\n'), LDrawDetail.LOW)
  drawing.updateMatrixWorld(true)
  parsed.updateMatrixWorld(true)
  const taken = getPartsTakenFromCarBody(parsed)
  const tolerance = MATCH_TOLERANCE_LDRAW_UNITS * body.matrixWorld.getMaxScaleOnAxis()
  const shown = createPointSet(tolerance)
  const hidden = createPointSet(tolerance)
  forEachVertex(drawing, (mesh, position) =>
    (getIsShownInWorld(mesh) && getIsMaterialShown(mesh.material) ? shown : hidden).add(position)
  )
  return lines.flatMap((line, index): readonly ModelPartFinding[] => {
    const part = parsed.children[index]
    if (part === undefined) return [getFinding(line, PartLoss.UNPARSED)]
    if (taken.has(part)) return []
    const counts = { all: 0, shown: 0, hidden: 0 }
    forEachVertex(part, (_mesh, position) => {
      const drawn = position.applyMatrix4(body.matrixWorld)
      counts.all += 1
      if (shown.has(drawn)) counts.shown += 1
      else if (hidden.has(drawn)) counts.hidden += 1
    })
    if (counts.all === 0 || counts.shown >= counts.all * MATCHED_SHARE) return []
    return [getFinding(line, counts.hidden > counts.shown ? PartLoss.INVISIBLE : PartLoss.DROPPED)]
  })
}
