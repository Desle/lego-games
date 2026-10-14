import type { RaceRacerDefinition, RaceState } from '../../../race/index.ts'
import type { Racer } from '../../../racer/index.ts'

// What it reads of each racer (racer set +0x3bc): the flags (+0xd04) and what the time behind is made of.
export type PointsTableRacerState = Pick<
  Racer,
  'flags' | 'currentLap' | 'lapMilliseconds' | 'racePosition'
>

// What the points table reads of the race: the state, the points record (+0x18), the laps and the racers.
export type PointsTableRaceState = Pick<
  RaceState,
  'phase' | 'phaseMilliseconds' | 'isRunning' | 'pointsRecord' | 'lapCount'
> & { readonly racerSet: { readonly racers: readonly PointsTableRacerState[] } }

// What it reads of each racer's slot: the name (racer +0xdec) and the slot's kind (settings +0x114 + 0x5c·i, 0 a player).
export type PointsTableRacer = Pick<RaceRacerDefinition, 'name' | 'controllerKind'>

// 0x00440350's two layouts: the race's points (`0`, Race_RenderState4) and the circuit's totals (`1`, Race_RenderState5).
export type PointsTableMode = 'race' | 'totals'
