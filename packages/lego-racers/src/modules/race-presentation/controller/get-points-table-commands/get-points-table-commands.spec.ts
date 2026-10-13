import type { HudCommand, HudLayout } from '../../../race-hud/index.ts'
import { getPointsRecordWithTotals, RacePhase } from '../../../race/index.ts'
import type { PointsRecord } from '../../../race/index.ts'
import { getPointsTableCommands, getPointsTableMode } from './get-points-table-commands.ts'
import type { PointsTableRaceState, PointsTableRacer } from './get-points-table-commands.types.ts'

const STRINGS: Readonly<Record<number, string>> = {
  0x2a: 'FINISHED',
  0x2b: 'STILL RACING',
  0x2d: 'CIRCUIT',
}
const context = {
  layout: { screenWidth: 640, screenHeight: 480 } as HudLayout,
  getString: (stringId: number) => STRINGS[stringId] ?? '',
  measureText: (_font: string, text: string) => ({ width: text.length * 10, height: 12 }),
}
const racers: readonly PointsTableRacer[] = ['PLAYER', 'B', 'C', 'D', 'E', 'F'].map(
  (name, index) => ({
    name,
    controllerKind: index === 0 ? 0 : 2,
  })
)

const getRaceState = (
  phase: PointsTableRaceState['phase'],
  phaseMilliseconds: number,
  record: PointsRecord
): PointsTableRaceState => ({
  phase,
  phaseMilliseconds,
  isRunning: true,
  pointsRecord: record,
  lapCount: 3,
  // Racers 0 and 3 are done (0x1000), racer 3 the faster.
  racerSet: {
    racers: Array.from({ length: 6 }, (_, index) => ({
      currentLap: index === 0 || index === 3 ? 3 : 1,
      flags: index === 0 || index === 3 ? 0x1000 : 0,
      lapMilliseconds:
        index === 0 ? [31_000, 30_000, 32_000, 0, 0] : [30_000, 30_000, 30_000, 0, 0],
      racePosition: 0,
    })),
  },
})

const getTexts = (commands: readonly HudCommand[]) =>
  commands.flatMap((command) =>
    command.kind === 'text' ? [[command.text, command.x, command.y]] : []
  )

describe('the points table', () => {
  it('shows the race table from 5 s into the finishing state and the totals in the results state', () => {
    // Arrange
    const record = getPointsRecordWithTotals([40, 25, 33, 10, 5, 7])

    // Act
    const modes = [
      getPointsTableMode(getRaceState(RacePhase.FINISHING, 5000, record)),
      getPointsTableMode(getRaceState(RacePhase.FINISHING, 5001, record)),
      getPointsTableMode(getRaceState(RacePhase.RESULTS, 0, record)),
      getPointsTableMode({ ...getRaceState(RacePhase.RESULTS, 0, record), pointsRecord: null }),
    ]

    // Assert
    expect(modes).toEqual([null, 'race', 'totals', null])
  })

  it('lists the race points with the leader, the time behind and the racers still racing', () => {
    // Arrange
    const record: PointsRecord = {
      ...getPointsRecordWithTotals([0, 0, 0, 0, 0, 0]),
      racePoints: [20, 0, 0, 30, 0, 0],
      tickerMilliseconds: 400,
    }

    // Act
    const texts = getTexts(
      getPointsTableCommands(getRaceState(RacePhase.FINISHING, 6000, record), context, racers)
    )

    // Assert
    expect(texts.slice(0, 9)).toEqual([
      ['1', 20, 132],
      ['D', 50, 132],
      ['30', 450, 132],
      ['FINISHED', 500, 132],
      ['2', 20, 164],
      ['PLAYER', 50, 164],
      ['20', 450, 164],
      ['0:03:00', 520, 164],
      ['+', 500, 164],
    ])
    expect(texts[12]).toEqual(['STILL RACING', 500, 196])
  })

  it('lists the totals under the centred title and hides the player row while the countdown is low', () => {
    // Arrange
    const record: PointsRecord = {
      ...getPointsRecordWithTotals([40, 25, 33, 10, 5, 7]),
      tickerMilliseconds: 149,
    }

    // Act
    const texts = getTexts(
      getPointsTableCommands(getRaceState(RacePhase.RESULTS, 100, record), context, racers)
    )

    // Assert
    expect(texts[0]).toEqual(['CIRCUIT', 285, 60])
    expect(texts.filter(([text]) => text === 'PLAYER')).toEqual([])
    expect(texts.slice(1, 4)).toEqual([
      ['2', 20, 164],
      ['C', 50, 164],
      ['33', 450, 164],
    ])
  })
})
