import { formatHudTime, HudFont } from '../../../race-hud/index.ts'
import type { HudCommand } from '../../../race-hud/index.ts'
import { RacePhase } from '../../../race/index.ts'
import type { HudContext } from '../../types/race-presentation.types.ts'
import { getRaceGaps } from '../get-race-gaps/get-race-gaps.ts'
import type {
  PointsTableMode,
  PointsTableRaceState,
  PointsTableRacer,
} from './get-points-table-commands.types.ts'

const SLOT_COUNT = 6 // the slot loops' bound, CMP EAX,0x6 at 0x004405e1
// Race_RenderState4 0x00435860 draws the race's table once the finishing state has run 5,000 ms (0x1388 at 0x004358a0).
const RACE_TABLE_DELAY_MILLISECONDS = 5000
// The rows: from y 0x84, every 0x20, while below 0x144.
const FIRST_ROW_Y = 0x84 // 0x004405b3
const ROW_HEIGHT = 0x20 // 0x00440810
const ROWS_END_Y = 0x144 // 0x00440820
// The columns.
const PLACE_X = 0x14 // 0x0044063b
const NAME_X = 0x32 // 0x00440661
const POINTS_X = 0x1c2 // 0x004406b6
const SIGN_X = 0x1f4 // 0x004407fc
const GAP_X = 0x208 // 0x00440765
// The totals' title: GAME.SRF 0x2d ("CIRCUIT", 0x004403b4) at y 0x3c.
const TITLE_STRING_ID = 0x2d
const TITLE_Y = 0x3c // 0x004403f9
// GAME.SRF 0x2a ("FINISHED", the race's points leader) and 0x2b ("STILL RACING").
const LEADER_STRING_ID = 0x2a // 0x004407d5
const RACING_STRING_ID = 0x2b // 0x004407cf
// 0x004bef74 and 0x004bef78: the sign in front of a finished racer's time behind the leader.
const BEHIND_SIGN = '+'
const AHEAD_SIGN = '-'
// A player's row shows while the record's countdown (+0x40, 400 ms around) is at 0x96 or more (0x0044045b, 0x004405e6).
const PLAYER_ROW_SHOWN_MILLISECONDS = 0x96
const PLAYER_SLOT_KIND = 0
const PLACED_FLAG = 0x1000 // racer +0xd04, tested at 0x00440710
const NO_COMMANDS: readonly HudCommand[] = Object.freeze([])

// Which layout the frame draws: the race's points after 5 s of the finishing state, the totals while the results
// state runs (Race_RenderState5 0x004358e0); neither without a points record or once the loop has ended.
export const getPointsTableMode = (raceState: PointsTableRaceState): PointsTableMode | null => {
  if (raceState.pointsRecord === null || !raceState.isRunning) return null
  if (raceState.phase === RacePhase.RESULTS) return 'totals'
  return raceState.phase === RacePhase.FINISHING &&
    raceState.phaseMilliseconds > RACE_TABLE_DELAY_MILLISECONDS
    ? 'race'
    : null
}

// The font's own colour (the table sets none, 0x00440350): the HUD's text font (race +0x2d7c, the menu's).
const getText = (text: string, x: number, y: number): HudCommand => ({
  kind: 'text',
  text,
  font: HudFont.TEXT,
  x,
  y,
  scaleX: 1,
  scaleY: 1,
  color: null,
})

// The rows' selection: an unused slot with the most points, among equals the last (`>=` from 0, 0x004405cc) for the
// race's points, the first above the rest (`>` from 0, 0x0044043b) for the totals. The slot of the previous row stays
// chosen when no unused slot passes (the totals' test is strict, so a slot without points repeats the row before).
const getRowSlots = (
  values: readonly number[],
  isTieTakingLater: boolean,
  firstSlot: number
): readonly number[] => {
  const used = new Array<boolean>(SLOT_COUNT).fill(false)
  const slots: number[] = []
  let chosen = firstSlot
  for (let y = FIRST_ROW_Y; y < ROWS_END_Y; y += ROW_HEIGHT) {
    let best = 0
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      const value = values[slot] ?? 0
      const isBetter = isTieTakingLater ? value >= best : value > best
      if (!used[slot] && isBetter) {
        best = value
        chosen = slot
      }
    }
    slots.push(chosen)
    used[chosen] = true
  }
  return slots
}

// The race's points leader (0x00440562..0x00440577: the last slot with the most points).
const getLeaderSlot = (racePoints: readonly number[]): number =>
  racePoints.reduce(
    (leader, points, slot) => (points >= (racePoints[leader] ?? 0) ? slot : leader),
    0
  )

// CircuitStandings_Draw 0x00440350: the points record's table over the race, in the HUD's text font. A player's row
// blinks with the record's countdown; the race's layout adds each finished racer's time behind the points leader
// (0x0043cf30) with its sign, the leader's "FINISHED" and the others' "STILL RACING"; the totals' layout has the title.
export const getPointsTableCommands = (
  raceState: PointsTableRaceState,
  context: Pick<HudContext, 'layout' | 'getString' | 'measureText'>,
  racers: readonly PointsTableRacer[]
): readonly HudCommand[] => {
  const mode = getPointsTableMode(raceState)
  const record = raceState.pointsRecord
  if (mode === null || record === null) return NO_COMMANDS
  const getIsRowShown = (slot: number) =>
    record.tickerMilliseconds >= PLAYER_ROW_SHOWN_MILLISECONDS ||
    racers[slot]?.controllerKind !== PLAYER_SLOT_KIND
  const getRowStart = (slot: number, row: number, value: number): readonly HudCommand[] => {
    const y = FIRST_ROW_Y + row * ROW_HEIGHT
    return [
      getText(String(row + 1), PLACE_X, y),
      getText(racers[slot]?.name ?? '', NAME_X, y),
      getText(String(value), POINTS_X, y),
    ]
  }
  if (mode === 'totals') {
    const title = context.getString(TITLE_STRING_ID)
    const titleX =
      (context.layout.screenWidth >>> 1) - (context.measureText(HudFont.TEXT, title).width >>> 1)
    return [
      getText(title, titleX, TITLE_Y),
      ...getRowSlots(record.totalPoints, false, 0).flatMap((slot, row) =>
        getIsRowShown(slot) ? getRowStart(slot, row, record.totalPoints[slot] ?? 0) : []
      ),
    ]
  }
  const leader = getLeaderSlot(record.racePoints)
  const gaps = getRaceGaps(raceState.racerSet.racers, raceState.lapCount, leader)
  // The sign starts at "+" once for the table (0x00440551) and a gap of 0 keeps the last one.
  let sign = 1
  return getRowSlots(record.racePoints, true, leader).flatMap(
    (slot, row): readonly HudCommand[] => {
      if (!getIsRowShown(slot)) return []
      const y = FIRST_ROW_Y + row * ROW_HEIGHT
      const start = getRowStart(slot, row, record.racePoints[slot] ?? 0)
      const gap = gaps.find((entry) => entry.racerIndex === slot)
      if (gap === undefined) return start
      if (slot === leader)
        return [...start, getText(context.getString(LEADER_STRING_ID), SIGN_X, y)]
      const flags = raceState.racerSet.racers[slot]?.flags ?? 0
      if ((flags & PLACED_FLAG) === 0) {
        return [...start, getText(context.getString(RACING_STRING_ID), SIGN_X, y)]
      }
      if (gap.gapMilliseconds > 0) sign = 1
      if (gap.gapMilliseconds < 0) sign = -1
      const time = getText(formatHudTime(Math.abs(gap.gapMilliseconds)), GAP_X, y)
      return [...start, time, getText(sign === 1 ? BEHIND_SIGN : AHEAD_SIGN, SIGN_X, y)]
    }
  )
}
