import { LDrawDetail } from './ldraw-library-loader.types.ts'
import {
  getIsStudLogoRequested,
  getIsStudLogoShown,
  getModelDetail,
  setIsStudLogoShown,
} from './stud-logos.ts'

describe('stud logos', () => {
  afterEach(() => setIsStudLogoShown(true))

  it('reads the switch from the address, on by default', () => {
    // Arrange / Act
    const requests = ['?hd', '?hd&studlogos=1', '?hd&studlogos=0'].map(getIsStudLogoRequested)

    // Assert
    expect(requests).toEqual([true, true, false])
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
    // Arrange / Act
    const detail = getModelDetail(LDrawDetail.HIGH)

    // Assert
    expect(detail).toBe(LDrawDetail.HIGH)
  })
})
