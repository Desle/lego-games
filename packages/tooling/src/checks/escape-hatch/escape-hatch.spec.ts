import { CheckId } from '../check.types.ts'
import { getIsAllowedByEscapeHatch } from './escape-hatch.ts'

describe('getIsAllowedByEscapeHatch', () => {
  it('accepts a reasoned exception on the same line or the line above', () => {
    // Arrange
    const content = [
      'type A = 1 // @check-allow types-in-types-files: generated',
      '// @check-allow types-in-types-files: adapter for a library',
      'type B = 2',
    ].join('\n')

    // Act
    const isSameLineAllowed = getIsAllowedByEscapeHatch(content, 1, CheckId.TYPES_IN_TYPES_FILES)
    const isLineAboveAllowed = getIsAllowedByEscapeHatch(content, 3, CheckId.TYPES_IN_TYPES_FILES)

    // Assert
    expect(isSameLineAllowed).toBe(true)
    expect(isLineAboveAllowed).toBe(true)
  })

  it('rejects exceptions without a reason or for another check', () => {
    // Arrange
    const content = [
      'type A = 1 // @check-allow types-in-types-files:',
      'type B = 2 // @check-allow layer-boundaries: wrong check',
    ].join('\n')

    // Act
    const isMissingReasonAllowed = getIsAllowedByEscapeHatch(
      content,
      1,
      CheckId.TYPES_IN_TYPES_FILES
    )
    const isWrongCheckAllowed = getIsAllowedByEscapeHatch(content, 2, CheckId.TYPES_IN_TYPES_FILES)

    // Assert
    expect(isMissingReasonAllowed).toBe(false)
    expect(isWrongCheckAllowed).toBe(false)
  })
})
