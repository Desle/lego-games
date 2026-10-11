import { openJamArchive } from '../../../jam-archive/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { getFigureBounds } from '../../../racer/index.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getRacerFilePath } from '../../services/load-racer-figures/load-racer-figures.ts'
import { createRacerFigures } from './create-racer-figures.ts'

const MODEL_SCALE = 0.015625

describe('createRacerFigures', () => {
  it.skipIf(!getIsOriginalJamPresent())(
    'reads the clips of the wheels and the pelvis from their animation files',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())

      // Act
      const figures = createRacerFigures({
        wheels: {
          animationBytes: archive.readFile(getRacerFilePath('dajmw', 'ADB')),
          modelScale: MODEL_SCALE,
        },
        secondWheels: null,
        driver: {
          animationBytes: archive.readFile(getRacerFilePath('pelvis', 'ADB')),
          modelScale: MODEL_SCALE,
        },
      })

      // Assert
      expect(figures.wheels.animations).toHaveLength(2)
      expect(figures.wheels.animations[0]).toMatchObject({
        rate: Math.fround(30 * Math.fround(0.001)),
        frameCount: 34,
        period: 35,
      })
      expect(figures.wheels.animations[1]).toMatchObject({ frameCount: 31, period: 32 })
      expect(figures.driver.animations).toHaveLength(18)
      expect(figures.driver.animations[9]).toMatchObject({ frameCount: 0, period: 1 })
      expect(figures.secondWheels).toBeNull()
    }
  )

  it.skipIf(!getIsOriginalJamPresent())(
    'starts the wheels in animation 0 and the driver in animation 9, both playing',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())

      // Act
      const figures = createRacerFigures({
        wheels: {
          animationBytes: archive.readFile(getRacerFilePath('dajmw', 'ADB')),
          modelScale: MODEL_SCALE,
        },
        secondWheels: null,
        driver: {
          animationBytes: archive.readFile(getRacerFilePath('pelvis', 'ADB')),
          modelScale: MODEL_SCALE,
        },
      })

      // Assert
      expect(figures.wheels).toMatchObject({ currentId: 0, currentTime: 0 })
      expect(figures.wheels.flags & 0x10000).not.toBe(0)
      expect(figures.driver).toMatchObject({ currentId: 9, currentTime: 0 })
      expect(figures.driver.flags & 0x10000).not.toBe(0)
    }
  )

  it.skipIf(!getIsOriginalJamPresent())(
    'bounds a wheel figure by its clip radius times the model scale',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)

      // Act
      const figures = createRacerFigures({
        wheels: {
          animationBytes: archive.readFile(getRacerFilePath('dajmw', 'ADB')),
          modelScale: MODEL_SCALE,
        },
        secondWheels: null,
        driver: {
          animationBytes: archive.readFile(getRacerFilePath('pelvis', 'ADB')),
          modelScale: MODEL_SCALE,
        },
      })

      // Assert
      const bounds = getFigureBounds(arithmetic, figures.wheels)
      expect(bounds?.radius).toBeCloseTo(329.1226 * MODEL_SCALE, 3)
    }
  )
})
