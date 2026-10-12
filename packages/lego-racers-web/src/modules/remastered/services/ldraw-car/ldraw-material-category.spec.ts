import { MeshStandardMaterial } from 'three'
import { LOOK_APPEARANCES } from './ldraw-look.ts'
import { MaterialCategory } from './ldraw-look.types.ts'
import { getMaterialCategory, getMaterialSurface } from './ldraw-material-category.ts'

describe('getMaterialCategory', () => {
  it('tells the library finishes apart', () => {
    // Arrange
    const finishes = [
      new MeshStandardMaterial({ roughness: 0.3, metalness: 0 }),
      new MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
      new MeshStandardMaterial({ roughness: 0.3, metalness: 0, transparent: true }),
      new MeshStandardMaterial({ roughness: 0, metalness: 1 }),
      new MeshStandardMaterial({ roughness: 0.2, metalness: 0.85 }),
      new MeshStandardMaterial({ roughness: 0.3, metalness: 0.25 }),
    ]

    // Act
    const categories = finishes.map(getMaterialCategory)

    // Assert
    expect(categories).toEqual([
      MaterialCategory.PLASTIC,
      MaterialCategory.RUBBER,
      MaterialCategory.TRANSPARENT,
      MaterialCategory.CHROME,
      MaterialCategory.METALLIC,
      MaterialCategory.PLASTIC,
    ])
  })
})

describe('getMaterialSurface', () => {
  it('gives rubber a matte surface without a clear coat in the photo look and keeps the plastic glossy', () => {
    // Arrange
    const source = new MeshStandardMaterial({ roughness: 0.9 })

    // Act
    const rubber = getMaterialSurface(MaterialCategory.RUBBER, source, LOOK_APPEARANCES.photo)
    const plastic = getMaterialSurface(MaterialCategory.PLASTIC, source, LOOK_APPEARANCES.photo)

    // Assert
    expect(rubber.roughness).toBeGreaterThan(0.85)
    expect(rubber.clearcoat).toBe(0)
    expect(rubber.environmentIntensity).toBeLessThan(plastic.environmentIntensity)
    expect([plastic.roughness, plastic.clearcoat]).toEqual([0.2, 1])
  })
})
