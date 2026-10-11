import { createEnum } from '../../../../shared/types/enum.types.ts'

export const RaceStatus = createEnum({
  IDLE: 'idle',
  LOADING: 'loading',
  RUNNING: 'running',
  FAILED: 'failed',
})
