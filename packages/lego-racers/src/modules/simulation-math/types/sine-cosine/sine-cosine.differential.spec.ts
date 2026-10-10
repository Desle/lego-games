import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import { getSineCosine } from './sine-cosine.ts'

// Math_SinCos 0x00449170 (cdecl: angle, sine target, cosine target)
defineDifferentialSuite({
  definition: {
    name: 'Math_SinCos',
    address: 0x00449170,
    convention: 'cdecl',
    slots: [
      { kind: 'float', index: 0 },
      { kind: 'output', name: 'sine', floatCount: 1 },
      { kind: 'output', name: 'cosine', floatCount: 1 },
    ],
    runPort: (precision, input) => {
      const { sine, cosine } = getSineCosine(createFloatArithmetic(precision), input[0] ?? 0)
      return [sine, cosine]
    },
  },
  generateInput: (sampler) => [sampler.sampleAngle(7)],
  fixedInputs: [[0], [-0], [Math.fround(Math.PI)], [Math.fround(Math.PI / 2)], [1e6]],
})
