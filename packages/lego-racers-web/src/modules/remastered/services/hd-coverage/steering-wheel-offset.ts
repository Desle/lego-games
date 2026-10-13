import { Matrix4, Vector3 } from 'three'

const FILE_LINE = /^\s*0\s+FILE\s+(.+?)\s*$/i
const REFERENCE_LINE = /^\s*1\s+\S+((?:\s+\S+){12})\s+(\S+)\s*$/
const STEERING_WHEEL_PARTS: ReadonlySet<string> = new Set(['3829c01.dat', '3829.dat', '30663.dat'])
const MAXIMUM_DEPTH = 8

export const getRounded = (value: number): number => Number(value.toFixed(1))

// The files of an LDraw text by their lower-case names; the main model is ''.
const getModelFiles = (text: string): ReadonlyMap<string, readonly string[]> => {
  const files = new Map<string, string[]>([['', []]])
  let current = ''
  for (const line of text.split('\n')) {
    const fileMatch = FILE_LINE.exec(line)
    if (fileMatch !== null) {
      current = (fileMatch[1] ?? '').toLowerCase()
      files.set(current, [])
      continue
    }
    files.get(current)?.push(line)
  }
  return files
}

// A type 1 line's numbers (`x y z` and the nine of the matrix, row by row) as a matrix.
const getLineMatrix = (numbers: readonly number[]): Matrix4 => {
  const [x = 0, y = 0, z = 0, ...rotation] = numbers
  const [m11 = 1, m12 = 0, m13 = 0, m21 = 0, m22 = 1, m23 = 0, m31 = 0, m32 = 0, m33 = 1] = rotation
  return new Matrix4().set(m11, m12, m13, x, m21, m22, m23, y, m31, m32, m33, z, 0, 0, 0, 1)
}

// Where the steering wheels of a model are, in its main file's LDraw frame, through the sub-models (a chassis recipe) it refers to.
const findSteeringWheels = (
  files: ReadonlyMap<string, readonly string[]>,
  name: string,
  frame: Matrix4,
  depth: number
): readonly Vector3[] =>
  depth > MAXIMUM_DEPTH
    ? []
    : (files.get(name) ?? []).flatMap((line) => {
        const match = REFERENCE_LINE.exec(line)
        if (match === null) return []
        const file = (match[2] ?? '').toLowerCase()
        const matrix = frame
          .clone()
          .multiply(getLineMatrix((match[1] ?? '').trim().split(/\s+/).map(Number)))
        if (STEERING_WHEEL_PARTS.has(file)) return [new Vector3().setFromMatrixPosition(matrix)]
        return files.has(file) ? findSteeringWheels(files, file, matrix, depth + 1) : []
      })

// The steering wheel's sideways place in the car (LDraw units, to the car's left): the file's z is the car's y. Null without one.
export const getSteeringWheelOffset = (text: string): number | null => {
  const wheels = findSteeringWheels(getModelFiles(text), '', new Matrix4(), 0)
  if (wheels.length === 0) return null
  return getRounded(wheels.reduce((sum, wheel) => sum + wheel.z, 0) / wheels.length)
}
