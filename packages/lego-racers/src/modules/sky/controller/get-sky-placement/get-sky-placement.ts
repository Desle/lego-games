import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import {
  BACKDROP_HEIGHT_REFERENCE,
  DOME_HEIGHT_REFERENCE,
} from '../../types/sky-constants/sky-constants.ts'
import type { SkyPlacement, SkyPoint } from '../../types/sky.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// LEGORacers.exe 0x0041d040 (called from Race_Render 0x004354d0 with the camera frame's position): the sky dome
// is set at the camera's position with `z - (10 - height)`, then every instance of the backdrop world at
// `(40 - height) + that z`, `height` being the SKB's optional float (sky +0xac, 0 when absent). Both follow the
// camera in x and y and never rotate.
export const getSkyPlacement = (cameraPosition: SkyPoint, height: number): SkyPlacement => {
  const domeZ = arithmetic.storeFloat(
    arithmetic.subtract(cameraPosition.z, arithmetic.subtract(DOME_HEIGHT_REFERENCE, height))
  )
  const backdropZ = arithmetic.storeFloat(
    arithmetic.add(arithmetic.subtract(BACKDROP_HEIGHT_REFERENCE, height), domeZ)
  )
  return Object.freeze({
    dome: Object.freeze({ x: cameraPosition.x, y: cameraPosition.y, z: domeZ }),
    backdrop: Object.freeze({ x: cameraPosition.x, y: cameraPosition.y, z: backdropZ }),
  })
}
