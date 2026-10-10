import { createEnum } from '../../../../shared/types/enum.types.ts'

// What 0x00438f20 does with the held power-up: use it (0x00439100), wait 1,000 ms before the next check
// (racer +0xcdc = 1000), or keep it and check again after the usual 150 ms.
export const PowerUpUseDecision = createEnum({
  USE: 'use',
  WAIT: 'wait',
  KEEP: 'keep',
})
