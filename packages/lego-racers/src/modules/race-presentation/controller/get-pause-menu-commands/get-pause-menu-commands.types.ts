import type { RaceState } from '../../../race/index.ts'

// What the menu reads of the race: its state, the points record (+0x18) and the ghost (+0x3364).
export type MenuRaceState = Pick<RaceState, 'pauseMenu' | 'pointsRecord' | 'ghost'>

export type MenuTexts = {
  readonly title: number
  readonly subtitle: number | null
  readonly items: readonly number[]
}
