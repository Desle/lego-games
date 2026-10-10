import { createEnum } from '../../../../shared/types/enum.types.ts'

// x87 precision control (FPU control word bits 8-9) while a race runs; see physics.md, "Precision policy".
export const FpuPrecision = createEnum({
  SINGLE: 'single',
  DOUBLE: 'double',
})
