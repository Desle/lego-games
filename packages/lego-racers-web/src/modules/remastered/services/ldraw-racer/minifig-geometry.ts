import { Matrix4, Vector3 } from 'three'
import type { MinifigGeometry, MinifigHinge, MinifigSide } from './minifig-geometry.types.ts'

// The library's complete figures (`15396c02`, `4480c05`, `980`) stack the parts at these offsets: the torso 32 above the top of the hips
// (its hem on the hips, the hips' stud inside it), the head 24 above the torso (its rim on the shoulders, the neck inside it), the legs
// 12 below the top of the hips, on the hip axle. The library's `979` and `980` put the head 28 above, off the shoulders.
const TORSO_Y = -32
const HEAD_Y = TORSO_Y - 24
const HIP_AXLE_Y = 12
// `973c01`: the arms at (15.552, 9) of the torso, turned 9.78 degrees to lie on its slanted sides (14.345 wide at y 2, 19 at y 29).
const SHOULDER_X = 15.552
const SHOULDER_Y = TORSO_Y + 9
const ARM_TILT = (9.78 * Math.PI) / 180
const SIDES: readonly MinifigSide[] = Object.freeze(['left', 'right'])

// `973c01`'s hands, in the torso's frame; a hand's pin is its own z axis, through its origin.
const HANDS_IN_TORSO_FRAME: Readonly<Record<MinifigSide, readonly number[]>> = Object.freeze({
  left: Object.freeze([
    0.985, 0.1202, -0.1202, 23.6904, -0.17, 0.6964, -0.6964, 26.774, 0, 0.707, 0.707, -9.8982,
  ]),
  right: Object.freeze([
    0.985, -0.1202, 0.1202, -23.6904, 0.17, 0.6964, -0.6964, 26.774, 0, 0.707, 0.707, -9.8982,
  ]),
})

// The left arm (`3819`) is on the figure's left, the viewer's right as the figure faces -z: +x.
export const getSideSign = (side: MinifigSide): number => (side === 'left' ? 1 : -1)

const getTranslation = (x: number, y: number, z: number): Matrix4 =>
  new Matrix4().makeTranslation(x, y, z)

const getArmMatrix = (side: MinifigSide): Matrix4 =>
  getTranslation(getSideSign(side) * SHOULDER_X, SHOULDER_Y, 0).multiply(
    new Matrix4().makeRotationZ(-getSideSign(side) * ARM_TILT)
  )

// The rows of an LDraw placement (three of rotation and offset), read as three.js reads its own (columns first).
const getHandMatrix = (side: MinifigSide): Matrix4 =>
  getTranslation(0, TORSO_Y, 0).multiply(
    new Matrix4().fromArray([...HANDS_IN_TORSO_FRAME[side], 0, 0, 0, 1]).transpose()
  )

const getHingeOf = (matrix: Matrix4, localAxis: Vector3): MinifigHinge =>
  Object.freeze({
    pivot: new Vector3().setFromMatrixPosition(matrix),
    axis: localAxis.clone().transformDirection(matrix),
  })

const getBySide = <Value>(create: (side: MinifigSide) => Value): Record<MinifigSide, Value> =>
  Object.freeze({ left: create('left'), right: create('right') })

export const MINIFIG_SIDES = SIDES

export const MINIFIG_GEOMETRY: MinifigGeometry = Object.freeze({
  torso: getTranslation(0, TORSO_Y, 0),
  head: getTranslation(0, HEAD_Y, 0),
  legs: getTranslation(0, HIP_AXLE_Y, 0),
  arms: getBySide(getArmMatrix),
  hands: getBySide(getHandMatrix),
  hip: Object.freeze({ pivot: new Vector3(0, HIP_AXLE_Y, 0), axis: new Vector3(1, 0, 0) }),
  neck: Object.freeze({ pivot: new Vector3(0, TORSO_Y, 0), axis: new Vector3(0, 1, 0) }),
  shoulders: getBySide((side) => getHingeOf(getArmMatrix(side), new Vector3(1, 0, 0))),
  wrists: getBySide((side) => getHingeOf(getHandMatrix(side), new Vector3(0, 0, 1))),
})
