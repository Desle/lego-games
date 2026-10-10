import type { FloatArithmetic, SineCosine } from '../simulation-math.types.ts'

// Math_SinCos 0x00449170 (cdecl: angle, sine target, cosine target): one FSINCOS, both results stored as float32.
export const getSineCosine = (arithmetic: FloatArithmetic, angle: number): SineCosine =>
  Object.freeze({
    sine: arithmetic.storeFloat(arithmetic.getSine(angle)),
    cosine: arithmetic.storeFloat(arithmetic.getCosine(angle)),
  })
