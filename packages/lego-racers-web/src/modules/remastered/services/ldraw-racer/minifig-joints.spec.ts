import { Matrix4, Vector3 } from 'three'
import { MinifigPartKey } from './minifig-assembly.types.ts'
import { MINIFIG_GEOMETRY } from '@lego-games/ldraw/minifig'
import { MINIFIG_JOINT_LIMITS, getJointMatrices } from './minifig-joints.ts'
import { getMinifigRig } from './minifig-rig.ts'
import type { MinifigRig } from './minifig-rig.types.ts'

const FIGURE_FRAME = new Matrix4().makeScale(3.2, 3.2, 3.2)
const TOLERANCE = 1e-9
const SEATED_BONES = ['rrpelvis', 'torso', 'arm_l', 'arm_r', 'dummy01', 'head']
const HEAD_BONE = 4
const LEFT_ARM_BONE = 2

const getSeatedRig = (): MinifigRig => {
  const rig = getMinifigRig(SEATED_BONES)
  if (rig === null) throw new Error('The seated skeleton has no rig')
  return rig
}

const REST = SEATED_BONES.map(() => new Matrix4())

const getPose = (boneIndex: number, matrix: Matrix4): readonly Matrix4[] =>
  REST.map((rest, index) => (index === boneIndex ? matrix : rest))

const getMatrix = (matrices: ReadonlyMap<MinifigPartKey, Matrix4>, key: MinifigPartKey) =>
  matrices.get(key) ?? new Matrix4()

const getPlaced = (point: Vector3, matrix: Matrix4) => point.clone().applyMatrix4(matrix)

describe('getJointMatrices', () => {
  it('keeps the torso and the hips one piece, as the library assembles them', () => {
    // Arrange / Act
    const matrices = getJointMatrices(getSeatedRig(), REST, REST, FIGURE_FRAME)

    // Assert
    expect([
      getMatrix(matrices, MinifigPartKey.HIPS).equals(FIGURE_FRAME),
      getMatrix(matrices, MinifigPartKey.TORSO).equals(FIGURE_FRAME),
    ]).toEqual([true, true])
  })

  it('swings a seated leg forward on the hip axle, so it stays on the hips', () => {
    // Arrange / Act
    const matrices = getJointMatrices(getSeatedRig(), REST, REST, FIGURE_FRAME)
    const leg = getMatrix(matrices, MinifigPartKey.LEFT_LEG)
    const hanging = new Vector3(0, 1, 0).transformDirection(leg)
    const axle = getPlaced(MINIFIG_GEOMETRY.hip.pivot, leg)

    // Assert
    expect(hanging.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(TOLERANCE)
    expect(axle.distanceTo(getPlaced(MINIFIG_GEOMETRY.hip.pivot, FIGURE_FRAME))).toBeLessThan(
      TOLERANCE
    )
  })

  it('turns the head only about the upright neck, so a tilted head bone cannot tip it off the torso', () => {
    // Arrange
    const tiltedAndTurned = new Matrix4()
      .makeRotationY(Math.PI / 4)
      .multiply(new Matrix4().makeRotationX(Math.PI / 6))
    const pose = getPose(HEAD_BONE, tiltedAndTurned)

    // Act
    const head = getMatrix(
      getJointMatrices(getSeatedRig(), REST, pose, FIGURE_FRAME),
      MinifigPartKey.HEAD
    )
    const up = new Vector3(0, -1, 0).transformDirection(head)
    const neck = getPlaced(MINIFIG_GEOMETRY.neck.pivot, head)

    // Assert
    expect(up.distanceTo(new Vector3(0, -1, 0))).toBeLessThan(TOLERANCE)
    expect(neck.distanceTo(getPlaced(MINIFIG_GEOMETRY.neck.pivot, FIGURE_FRAME))).toBeLessThan(
      TOLERANCE
    )
    expect(new Vector3(0, 0, -1).transformDirection(head).x).not.toBeCloseTo(0)
  })

  it('swings an arm only about its shoulder pin, whichever way its bone points', () => {
    // Arrange
    const outward = new Matrix4().makeRotationY(-Math.PI / 3)
    const pose = getPose(LEFT_ARM_BONE, outward)
    const shoulder = MINIFIG_GEOMETRY.shoulders.left

    // Act
    const arm = getMatrix(
      getJointMatrices(getSeatedRig(), REST, pose, FIGURE_FRAME),
      MinifigPartKey.LEFT_ARM
    )
    const pin = shoulder.axis
      .clone()
      .transformDirection(MINIFIG_GEOMETRY.arms.left.clone().invert())

    // Assert
    expect(
      getPlaced(shoulder.pivot, arm).distanceTo(getPlaced(shoulder.pivot, FIGURE_FRAME))
    ).toBeLessThan(TOLERANCE)
    expect(
      pin
        .transformDirection(arm.clone().multiply(MINIFIG_GEOMETRY.arms.left))
        .distanceTo(shoulder.axis.clone().normalize())
    ).toBeLessThan(TOLERANCE)
  })

  it('keeps a hand on the end of its arm', () => {
    // Arrange
    const pose = getPose(LEFT_ARM_BONE, new Matrix4().makeRotationX(Math.PI / 5))
    const wrist = MINIFIG_GEOMETRY.wrists.left.pivot

    // Act
    const matrices = getJointMatrices(getSeatedRig(), REST, pose, FIGURE_FRAME)

    // Assert
    expect(
      getPlaced(wrist, getMatrix(matrices, MinifigPartKey.LEFT_HAND)).distanceTo(
        getPlaced(wrist, getMatrix(matrices, MinifigPartKey.LEFT_ARM))
      )
    ).toBeLessThan(TOLERANCE)
  })

  it('stops a leg at the furthest a minifigure leg swings back when the torso tips far back', () => {
    // Arrange
    const tippedBack = new Matrix4().makeRotationX(Math.PI / 2 + 1)
    const pose = getPose(1, tippedBack)

    // Act
    const leg = getMatrix(
      getJointMatrices(getSeatedRig(), REST, pose, FIGURE_FRAME),
      MinifigPartKey.LEFT_LEG
    )
    const torso = getMatrix(
      getJointMatrices(getSeatedRig(), REST, pose, FIGURE_FRAME),
      MinifigPartKey.TORSO
    )
    const relative = torso.clone().invert().multiply(leg)
    const hanging = new Vector3(0, 1, 0).transformDirection(relative)

    // Assert
    expect(Math.atan2(hanging.z, hanging.y)).toBeCloseTo(MINIFIG_JOINT_LIMITS.leg.maximum)
  })
})
