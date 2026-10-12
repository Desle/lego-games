import { Matrix4, Vector3 } from 'three'
import { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'
import { getJointMatrices } from './minifig-joints.ts'
import type { MinifigRig } from './minifig-rig.types.ts'

const NECK = new Vector3(0, -24, 0)
const HEAD_BONE_INDEX = 1
const FIGURE_FRAME = new Matrix4().makeScale(3.2, 3.2, 3.2)
const TOLERANCE = 1e-9

const getBone = (boneIndex: number) => ({ kind: 'bone' as const, boneIndex })

const createRig = (): MinifigRig => ({
  posture: MinifigPosture.SEATED,
  hipsHeight: 0,
  attachments: {
    [MinifigPartKey.HIPS]: getBone(0),
    [MinifigPartKey.LEFT_LEG]: getBone(0),
    [MinifigPartKey.RIGHT_LEG]: getBone(0),
    [MinifigPartKey.TORSO]: getBone(0),
    [MinifigPartKey.HEAD]: getBone(HEAD_BONE_INDEX),
    [MinifigPartKey.LEFT_ARM]: getBone(0),
    [MinifigPartKey.RIGHT_ARM]: getBone(0),
    [MinifigPartKey.LEFT_HAND]: getBone(0),
    [MinifigPartKey.RIGHT_HAND]: getBone(0),
  },
})

const getMatrix = (matrices: ReadonlyMap<MinifigPartKey, Matrix4>, key: MinifigPartKey) =>
  matrices.get(key) ?? new Matrix4()

describe('getJointMatrices', () => {
  it('leaves every part where the figure is assembled in the bind pose', () => {
    // Arrange
    const rest = [new Matrix4(), new Matrix4()]

    // Act
    const matrices = getJointMatrices(createRig(), rest, rest, FIGURE_FRAME)

    // Assert
    expect([...matrices.values()].every((matrix) => matrix.equals(FIGURE_FRAME))).toBe(true)
  })

  it('turns the head about the neck, so it stays on the torso', () => {
    // Arrange
    const rest = [new Matrix4(), new Matrix4()]
    const pose = [new Matrix4(), new Matrix4().makeRotationZ(Math.PI / 3)]

    // Act
    const matrices = getJointMatrices(createRig(), rest, pose, FIGURE_FRAME)
    const neckOfTorso = NECK.clone().applyMatrix4(getMatrix(matrices, MinifigPartKey.TORSO))
    const neckOfHead = NECK.clone().applyMatrix4(getMatrix(matrices, MinifigPartKey.HEAD))

    // Assert
    expect(neckOfHead.distanceTo(neckOfTorso)).toBeLessThan(TOLERANCE)
  })

  it('turns the head by the turn of its bone', () => {
    // Arrange
    const rest = [new Matrix4(), new Matrix4()]
    const pose = [new Matrix4(), new Matrix4().makeRotationZ(Math.PI / 2)]

    // Act
    const matrices = getJointMatrices(createRig(), rest, pose, FIGURE_FRAME)
    const turned = new Vector3(1, 0, 0).transformDirection(getMatrix(matrices, MinifigPartKey.HEAD))

    // Assert
    expect(turned.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(TOLERANCE)
  })
})
