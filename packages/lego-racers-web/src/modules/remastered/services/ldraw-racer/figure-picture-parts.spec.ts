import type { BodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { getFigurePartBytes, getModelPictureNames } from './figure-picture-parts.ts'

const entry = (name: string) => ({ name, value: 0 })
const body = (name: string) => ({ name, type: 0, value: 0 })

const CATALOG = {
  hats: [],
  hatMeshNames: ['head', 'helmetrr', 'cr_hat'],
  heads: { meshNames: ['heads'], entries: [entry('lh_'), entry('cr_'), entry('rr_')] },
  torsos: { meshNames: ['chests'], entries: [body('tu_chst'), body('cr_chst'), body('rr_chst')] },
  legs: { meshNames: ['legss'], entries: [body('leg_blck'), body('leg_peg'), body('rr_leg')] },
} as unknown as BodyPartCatalog

describe('getFigurePartBytes', () => {
  it("reads Captain Redbeard's hat, face, torso and legs off the first circuit's figure", () => {
    // Arrange
    const pictures = ['cr_angry', 'cr_blink', 'cr_dflt', 'cr_hat', 'leg_peg', 'cr_chst']

    // Act
    const bytes = getFigurePartBytes(CATALOG, pictures)

    // Assert
    expect(bytes).toEqual([2, 1, 1, 1, 0])
  })

  it("takes a champion's face before the plain one he wears under his helmet", () => {
    // Arrange
    const pictures = ['lh_dflt', 'rr_blink', 'rr_dflt', 'helmetrr', 'rr_leg', 'rr_chst']

    // Act
    const bytes = getFigurePartBytes(CATALOG, pictures)

    // Assert
    expect(bytes).toEqual([1, 2, 2, 2, 0])
  })

  it("gives the award's stand-in the plain face and no hat", () => {
    // Arrange
    const pictures = ['lh_blink', 'lh_dflt', 'lh_happy', 'leg_peg', 'cr_chst']

    // Act
    const bytes = getFigurePartBytes(CATALOG, pictures)

    // Assert
    expect(bytes).toEqual([0, 0, 1, 1, 0])
  })

  it('knows no parts of a figure that is only a glow', () => {
    // Arrange / Act
    const bytes = getFigurePartBytes(CATALOG, ['dzolv'])

    // Assert
    expect(bytes).toBeNull()
  })
})

describe('getModelPictureNames', () => {
  it("lists the pictures of the model's own mesh, in lower case, once each", () => {
    // Arrange
    const model = {
      scene: {
        instances: [{ levels: [{ meshIndex: 0 }] }],
        meshes: [{ materialIndices: [0, 1, 2] }],
        materials: [{ textureIndex: 0 }, { textureIndex: null }, { textureIndex: 0 }],
        textures: [{ name: 'CR_CHST' }],
      },
      meshScales: [1],
    } as unknown as ModelScene

    // Act
    const names = getModelPictureNames(model)

    // Assert
    expect(names).toEqual(['cr_chst'])
  })
})
