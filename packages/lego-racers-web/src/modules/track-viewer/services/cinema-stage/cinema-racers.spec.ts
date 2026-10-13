import { Vector3 } from 'three'
import { CINEMA_CARS, getCinemaCarFrame, getIsFigureSkeleton } from './cinema-racers.ts'

const TOLERANCE = 1e-9

describe('cinema racers', () => {
  it("puts the race's Captain Redbeard car into the first circuit's own, turned along its y and at 0.87", () => {
    // Arrange
    const car = CINEMA_CARS.get('MENUDATA\\CIRCUIT1\\CR_CAR.GDB')
    if (car === undefined) throw new Error('CR_CAR is not known')

    // Act
    const nose = new Vector3(1, 0, 0).applyMatrix4(getCinemaCarFrame(car))

    // Assert
    expect(nose.distanceTo(new Vector3(-1.304, 0.432 - 0.87, -1.602))).toBeLessThan(TOLERANCE)
  })

  it('names a champion car for every cinema car it knows', () => {
    // Arrange / Act
    const codes = [...CINEMA_CARS.values()].map((car) => car.carCode)

    // Assert
    expect(codes).toEqual(['CRCM', 'KKCM', 'BBCM', 'JTCM', 'BVBCM', 'GMCM', 'VVCM', 'RRCM'])
  })

  it("knows a figure's skeleton by its chest and thighs, whatever the cinema named them", () => {
    // Arrange
    const award = ['guy1', 'manrr', 'l_th2269', 'r_th2269', 'waistbrr', 'chestbrr', 'head-rr']
    const glow = ['guy02', 'glo', 'ches1644', 'manrr01', 'l_th2997', 'r_th2997']
    const car = ['vv_car', 'vv_rw', 'vv_fw']

    // Act
    const answers = [award, glow, car].map(getIsFigureSkeleton)

    // Assert
    expect(answers).toEqual([true, true, false])
  })
})
