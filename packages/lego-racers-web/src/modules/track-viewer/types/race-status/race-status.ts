import { createEnum } from '../../../../shared/types/enum.types.ts'

export const RaceStatus = createEnum({
  IDLE: 'idle',
  LOADING: 'loading',
  // The game's files are open and the front end (the menus) is showing.
  MENU: 'menu',
  RUNNING: 'running',
  FAILED: 'failed',
})
