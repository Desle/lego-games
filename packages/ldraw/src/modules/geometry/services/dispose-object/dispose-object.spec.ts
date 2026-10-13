import { BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { disposeObject, markGeometryShared } from './dispose-object.ts'

const createMesh = () => new Mesh(new BufferGeometry(), new MeshStandardMaterial())

const getIsDisposed = (target: BufferGeometry | MeshStandardMaterial): (() => boolean) => {
  let isDisposed = false
  target.addEventListener('dispose', () => {
    isDisposed = true
  })
  return () => isDisposed
}

describe('disposeObject', () => {
  it('frees what a drawing owns and leaves the geometry of a prepared model', () => {
    // Arrange
    const shared = createMesh()
    markGeometryShared(shared)
    const owned = createMesh()
    const group = new Group().add(shared, owned)
    const checks = [
      getIsDisposed(shared.geometry),
      getIsDisposed(shared.material),
      getIsDisposed(owned.geometry),
    ]

    // Act
    disposeObject(group)

    // Assert
    expect(checks.map((check) => check())).toEqual([false, true, true])
  })
})
