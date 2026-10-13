import { LDrawDetail } from '../ldraw-library-loader/ldraw-library-loader.types.ts'
import { getIsStudLogoShown, getModelDetail, setIsStudLogoShown } from './stud-logos.ts'

describe('stud logos', () => {
  afterEach(() => setIsStudLogoShown(false))

  it('draws plain studs by default', () => {
    // Arrange / Act
    const detail = getModelDetail(LDrawDetail.HIGH)

    // Assert
    expect([getIsStudLogoShown(), detail]).toEqual([false, LDrawDetail.LOW])
  })

  it('builds every model with plain studs when the logos are off', () => {
    // Arrange
    setIsStudLogoShown(false)

    // Act
    const details = [getModelDetail(LDrawDetail.HIGH), getModelDetail(LDrawDetail.LOW)]

    // Assert
    expect(getIsStudLogoShown()).toBe(false)
    expect(details).toEqual([LDrawDetail.LOW, LDrawDetail.LOW])
  })

  it('keeps the asked detail when the logos are on', () => {
    // Arrange
    setIsStudLogoShown(true)

    // Act
    const detail = getModelDetail(LDrawDetail.HIGH)

    // Assert
    expect(detail).toBe(LDrawDetail.HIGH)
  })
})
