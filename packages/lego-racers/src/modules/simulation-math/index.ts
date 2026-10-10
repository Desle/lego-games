export {
  createFloatArithmetic,
  RACE_FPU_PRECISION,
} from './types/float-arithmetic/float-arithmetic.ts'
export { FpuPrecision } from './types/fpu-precision/fpu-precision.ts'
export { getFrameAxes, getRotationFromFrameAxes } from './types/frame-axes/frame-axes.ts'
export { getMatrixInFrame, getMatrixProduct, IDENTITY_MATRIX3 } from './types/matrix/matrix.ts'
export {
  getBlendedQuaternion,
  getMatrixFromQuaternion,
  getQuaternionFromMatrix,
} from './types/quaternion/quaternion.ts'
export { getSineCosine } from './types/sine-cosine/sine-cosine.ts'
export {
  getNormalizedVector2,
  getNormalizedVector3,
  getVectorRotatedAroundAxis,
  ZERO_VECTOR3,
} from './types/vector/vector.ts'
export type {
  FloatArithmetic,
  FrameAxes,
  Matrix3,
  Quaternion,
  SineCosine,
  Vector2,
  Vector3,
} from './types/simulation-math.types.ts'
