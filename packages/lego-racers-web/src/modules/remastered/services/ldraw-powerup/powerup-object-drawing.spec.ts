import {
  BACK_FACES_VARIANT,
  POWER_UP_BRICK_MODEL_NAME,
} from '../../../../shared/viewer-extensions/effect-model-names.ts'
import type { LDrawModelIndex } from '../ldraw-models/ldraw-model-index.types.ts'
import { getEffectModelDrawingSource } from './powerup-object-drawing.ts'

const INDEX: LDrawModelIndex = {
  cars: {},
  chassis: {},
  drivers: {},
  powerUps: { DMISSILE: 'powerups/DMISSILE.ldr', PUBRICKY: 'powerups/PUBRICKY.ldr' },
  particles: {},
}

describe('getEffectModelDrawingSource', () => {
  it('draws a power-up object from its file, and nothing in place of its inside', () => {
    // Arrange
    const rocket = { modelName: 'DMISSILE', variant: null }
    const shieldInside = { modelName: 'DMISSILE', variant: BACK_FACES_VARIANT }

    // Act
    const sources = [rocket, shieldInside].map((request) =>
      getEffectModelDrawingSource(request, INDEX)
    )

    // Assert
    expect(sources).toEqual([
      { kind: 'file', file: 'powerups/DMISSILE.ldr' },
      { kind: 'nothing', file: null },
    ])
  })

  it('keeps the original of a power-up object without a file, inside and out', () => {
    // Arrange
    const requests = [
      { modelName: 'SHEOUT0', variant: null },
      { modelName: 'SHEOUT0', variant: BACK_FACES_VARIANT },
      { modelName: 'GRAPPLE', variant: null },
    ]

    // Act
    const sources = requests.map((request) => getEffectModelDrawingSource(request, INDEX))

    // Assert
    expect(sources).toEqual([null, null, null])
  })

  it('draws a pickup brick from its part in every look, whatever the folder holds', () => {
    // Arrange
    const request = { modelName: POWER_UP_BRICK_MODEL_NAME, variant: 'shield' }

    // Act
    const source = getEffectModelDrawingSource(request, INDEX)

    // Assert
    expect(source).toEqual({ kind: 'pickup_part', file: null })
  })
})
