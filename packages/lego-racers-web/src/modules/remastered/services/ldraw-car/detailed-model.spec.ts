import { BufferGeometry, Group, Mesh, MeshPhysicalMaterial } from 'three'
import { createMaterialSet, instantiateModel } from './detailed-model.ts'

const createPrepared = (material: MeshPhysicalMaterial): Group => {
  const prepared = new Group()
  prepared.add(new Mesh(new BufferGeometry(), material), new Mesh(new BufferGeometry(), material))
  return prepared
}

describe('createMaterialSet', () => {
  it('copies a material once however often it is asked for', () => {
    // Arrange
    const source = new MeshPhysicalMaterial({ color: 0xff0000 })
    const set = createMaterialSet()

    // Act
    const first = set.getCopy(source)
    const second = set.getCopy(source)

    // Assert
    expect([first === second, first === source]).toEqual([true, false])
  })

  it('keeps the look shader of the material it copies', () => {
    // Arrange
    const source = new MeshPhysicalMaterial()
    const customProgramCacheKey = () => 'ldraw-look'
    Object.assign(source, { customProgramCacheKey })

    // Act
    const copy = createMaterialSet().getCopy(source)

    // Assert
    expect(copy.customProgramCacheKey()).toBe('ldraw-look')
  })
})

describe('instantiateModel', () => {
  it('shares the geometry and gives the drawing its own materials', () => {
    // Arrange
    const source = new MeshPhysicalMaterial()
    const prepared = createPrepared(source)
    const first = instantiateModel(prepared, createMaterialSet())
    const second = instantiateModel(prepared, createMaterialSet())

    // Act
    const [firstMesh, secondMesh] = [first.children[0], second.children[0]]

    // Assert
    expect([
      firstMesh instanceof Mesh && firstMesh.geometry === (prepared.children[0] as Mesh).geometry,
      firstMesh instanceof Mesh &&
        secondMesh instanceof Mesh &&
        firstMesh.material === secondMesh.material,
      firstMesh instanceof Mesh && firstMesh.material === source,
    ]).toEqual([true, false, false])
  })

  it('draws the same material of one drawing with one copy', () => {
    // Arrange
    const prepared = createPrepared(new MeshPhysicalMaterial())

    // Act
    const copy = instantiateModel(prepared, createMaterialSet())
    const [first, second] = copy.children

    // Assert
    expect(
      first instanceof Mesh && second instanceof Mesh && first.material === second.material
    ).toBe(true)
  })
})
