import { Vector3 } from 'three'
import {
  ENHANCEMENT_BRICK_MODEL_NAME,
  POWER_UP_BRICK_MODEL_NAME,
} from '../../../../shared/viewer-extensions/effect-model-names.ts'
import { LDRAW_PICKUP_MAPPINGS } from './ldraw-pickup-mappings.ts'
import { getPickupColorCode, getPickupMatrix } from './ldraw-pickup-drawing.ts'

const getMapping = (name: string) => {
  const mapping = LDRAW_PICKUP_MAPPINGS[name]
  if (mapping === undefined) throw new Error(`No mapping for ${name}`)
  return mapping
}

describe('the LDraw pickups', () => {
  it('colours a power-up brick by its kind and the enhancement brick white', () => {
    // Arrange
    const mapping = getMapping(POWER_UP_BRICK_MODEL_NAME)
    const enhancement = getMapping(ENHANCEMENT_BRICK_MODEL_NAME)

    // Act
    const codes = ['projectile', 'shield', 'turbo', 'hazard'].map((variant) =>
      getPickupColorCode(mapping, { modelName: POWER_UP_BRICK_MODEL_NAME, variant })
    )

    // Assert
    expect([
      codes,
      getPickupColorCode(enhancement, { modelName: 'ENHABRIK', variant: null }),
    ]).toEqual([[4, 1, 2, 14], 15])
  })

  it('turns the brick without stretching it: a stud is 2.34 units along the length axis', () => {
    // Arrange
    const matrix = getPickupMatrix(getMapping(POWER_UP_BRICK_MODEL_NAME))

    // Act
    const stud = new Vector3(20, 0, 0)
      .applyMatrix4(matrix)
      .sub(new Vector3(0, 0, 0).applyMatrix4(matrix))

    // Assert
    expect(Number(stud.length().toFixed(2))).toBe(2.34)
  })
})
