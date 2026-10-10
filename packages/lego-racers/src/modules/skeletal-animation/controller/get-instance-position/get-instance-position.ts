import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../types/skeletal-animation.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, multiply, storeFloat } = arithmetic

// GolDP.dll 0x10027f40, the part of every instance update that moves it: the position plus the velocity
// (instance +0x1c) times the elapsed milliseconds, component by component. The material scroll offsets the
// same routine advances are not ported.
export const getInstancePosition = (
  position: Vector3,
  velocity: Vector3,
  deltaMilliseconds: number
): Vector3 => {
  const getComponent = (axis: 0 | 1 | 2): number =>
    storeFloat(add(position[axis], storeFloat(multiply(deltaMilliseconds, velocity[axis]))))
  return Object.freeze([getComponent(0), getComponent(1), getComponent(2)] as const)
}
