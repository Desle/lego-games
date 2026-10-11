import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import { getEmitterBasis } from './emitter-basis.ts'

const EMITTER_BYTE_SIZE = 0x18c
const BASIS_OFFSET = 0x160
const BASIS_FLOAT_COUNT = 9

// Emitter_SetOrientation 0x00489540 (thiscall: ECX the emitter, then the facing and the up direction).
defineDifferentialSuite({
  definition: {
    name: 'Emitter_SetOrientation',
    address: 0x00489540,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'emitter',
        byteSize: EMITTER_BYTE_SIZE,
        isArgument: true,
        fields: [],
        pointers: [],
        outputs: [{ byteOffset: BASIS_OFFSET, floatCount: BASIS_FLOAT_COUNT }],
      },
      { kind: 'floats', name: 'facing', start: 0, count: 3, isRead: false },
      { kind: 'floats', name: 'up', start: 3, count: 3, isRead: false },
    ],
    runPort: (precision, input) =>
      getEmitterBasis(
        createFloatArithmetic(precision),
        { x: input[0] ?? 0, y: input[1] ?? 0, z: input[2] ?? 0 },
        { x: input[3] ?? 0, y: input[4] ?? 0, z: input[5] ?? 0 }
      ),
  },
  generateInput: (sampler) => sampler.sampleList(6, 10),
  fixedInputs: [
    [0, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0, 1],
    [1, 2, 3, 3, 2, 1],
  ],
})
