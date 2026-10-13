import { Matrix4, Vector3 } from 'three'
import { MINIFIG_GEOMETRY, MinifigJoint } from '@lego-games/ldraw/minifig'
import { getMinifigPose } from './minifig-joints.ts'
import { getMinifigRig } from './minifig-rig.ts'
import type { MinifigRig } from './minifig-rig.types.ts'

const FIGURE_FRAME = new Matrix4().makeScale(3.2, 3.2, 3.2)
const TOLERANCE = 1e-9
const SEATED_BONES = ['rrpelvis', 'torso', 'arm_l', 'arm_r', 'dummy01', 'head']
const TORSO_BONE = 1
const HEAD_BONE = 4

const getSeatedRig = (): MinifigRig => {
  const rig = getMinifigRig(SEATED_BONES)
  if (rig === null) throw new Error('The seated skeleton has no rig')
  return rig
}

const REST = SEATED_BONES.map(() => new Matrix4())

const getPose = (boneIndex: number, matrix: Matrix4): readonly Matrix4[] =>
  REST.map((rest, index) => (index === boneIndex ? matrix : rest))

describe('getMinifigPose', () => {
  it('puts the hips and torso on the figure frame and swings a seated leg forward', () => {
    // Arrange / Act
    const pose = getMinifigPose(getSeatedRig(), REST, REST, FIGURE_FRAME)

    // Assert
    expect(pose.root.equals(FIGURE_FRAME)).toBe(true)
    expect(pose.angles[MinifigJoint.LEFT_HIP]).toBeCloseTo(-Math.PI / 2, 9)
  })

  it('turns the head by the share of its bone turn about the neck, whatever tilt the bone has', () => {
    // Arrange
    const tiltedAndTurned = new Matrix4()
      .makeRotationY(Math.PI / 4)
      .multiply(new Matrix4().makeRotationX(Math.PI / 6))

    // Act
    const pose = getMinifigPose(
      getSeatedRig(),
      REST,
      getPose(HEAD_BONE, tiltedAndTurned),
      FIGURE_FRAME
    )

    // Assert
    expect(pose.angles[MinifigJoint.NECK]).toBeCloseTo(Math.PI / 4, 9)
    expect(pose.root.equals(FIGURE_FRAME)).toBe(true)
  })

  it('leans the torso and hips about the hip axle with the torso bone', () => {
    // Arrange
    const leaning = new Matrix4().makeRotationX(0.4)

    // Act
    const pose = getMinifigPose(getSeatedRig(), REST, getPose(TORSO_BONE, leaning), FIGURE_FRAME)
    const axle = MINIFIG_GEOMETRY.hip.pivot.clone()

    // Assert
    expect(
      axle.clone().applyMatrix4(pose.root).distanceTo(axle.clone().applyMatrix4(FIGURE_FRAME))
    ).toBeLessThan(TOLERANCE)
    expect(new Vector3(0, -1, 0).transformDirection(pose.root).y).toBeCloseTo(-Math.cos(0.4), 9)
  })
})
