import { drawRandomRemainder, drawRandomValue } from '../../../random-table/index.ts'
import {
  getRacer,
  getRacerSetProgress,
  setRacer,
  setRandomPosition,
} from '../racer-state/racer-state.ts'
import type { RacerSet, RacerSetContext, RankingEntry } from '../racer.types.ts'

const NO_NEIGHBOUR = 0xff
const FLOAT32_MAXIMUM = 3.4028234663852886e38 // 0x7f7fffff
const FINISHED_FLAG = 0x2
const UNRANKED_FLAG = 0x1000
const VOICE_MINIMUM_MILLISECONDS = 5000
const VOICE_VARIANTS = 6

const swapEntries = (
  entries: readonly RankingEntry[],
  first: number,
  second: number,
  isSwappingDistance: boolean
): readonly RankingEntry[] =>
  entries.map((entry, index) => {
    const other = index === first ? entries[second] : index === second ? entries[first] : undefined
    if (other === undefined) return entry
    return Object.freeze({
      racerIndex: other.racerIndex,
      progress: other.progress,
      distance: isSwappingDistance ? other.distance : entry.distance,
    })
  })

const getEntry = (entries: readonly RankingEntry[], index: number): RankingEntry => {
  const entry = entries[index]
  if (entry === undefined) throw new RangeError(`No ranking entry ${String(index)}`)
  return entry
}

// Selection sort over [start, end): picks the entry `isBetter` prefers to anything after it (strict test, first wins).
const sortByKey = (
  entries: readonly RankingEntry[],
  start: number,
  end: number,
  getKey: (entry: RankingEntry) => number,
  isBetter: (candidate: number, best: number) => boolean,
  isSwappingDistance: boolean
): readonly RankingEntry[] => {
  if (start + 1 >= end) return entries
  const bestIndex = Array.from(
    { length: end - start - 1 },
    (_, offset) => start + 1 + offset
  ).reduce(
    (best, index) =>
      isBetter(getKey(getEntry(entries, index)), getKey(getEntry(entries, best))) ? index : best,
    start
  )
  const swapped =
    bestIndex > start ? swapEntries(entries, start, bestIndex, isSwappingDistance) : entries
  return sortByKey(swapped, start + 1, end, getKey, isBetter, isSwappingDistance)
}

// Distance of a racer's display position to the nearest neighbour plane of `checkpointIndex`.
const getCheckpointDistance = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  checkpointIndex: number
): number => {
  const { add, multiply, storeFloat, getIsBelow } = context.arithmetic
  const position = getRacer(racerSet, racerIndex).carBody.rigidBody.displayFrame.position
  const neighbours = context.checkpoints[checkpointIndex]?.links ?? []
  return neighbours.reduce((nearest, identifier) => {
    const checkpoint = context.checkpoints[identifier]
    if (identifier === NO_NEIGHBOUR || checkpoint === undefined) return nearest
    const [normalX, normalY, normalZ, offset] = checkpoint.plane
    const distance = add(
      add(
        add(multiply(normalZ, position.z), multiply(normalY, position.y)),
        multiply(position.x, normalX)
      ),
      offset
    )
    return getIsBelow(distance, nearest) ? storeFloat(distance) : nearest
  }, FLOAT32_MAXIMUM)
}

// The end (exclusive) of the run of entries whose progress equals entry `start`'s (0x0043c2a9..0x0043c2d3).
const getTieEnd = (
  context: RacerSetContext,
  entries: readonly RankingEntry[],
  start: number
): number => {
  const progress = getEntry(entries, start).progress
  const isTied = (index: number): boolean =>
    index < entries.length &&
    context.arithmetic.getIsEqual(progress, getEntry(entries, index).progress)
  const findEnd = (index: number): number =>
    index < entries.length && isTied(index) ? findEnd(index + 1) : index
  return isTied(start + 1) ? findEnd(start + 2) : start + 1
}

// Ties are broken by the distance to the checkpoint planes of the first tied racer's checkpoint, largest first.
const breakTie = (
  context: RacerSetContext,
  racerSet: RacerSet,
  entries: readonly RankingEntry[],
  start: number
): readonly RankingEntry[] => {
  const end = getTieEnd(context, entries, start)
  const checkpointIndex = getRacer(racerSet, getEntry(entries, start).racerIndex).checkpointIndex
  if (end <= start + 1 || context.checkpoints[checkpointIndex] === undefined) return entries
  const measured = entries.map((entry, index) =>
    index >= start && index < end
      ? Object.freeze({
          ...entry,
          distance: getCheckpointDistance(context, racerSet, entry.racerIndex, checkpointIndex),
        })
      : entry
  )
  return sortByKey(
    measured,
    start,
    end,
    (entry) => entry.distance,
    (candidate, best) => context.arithmetic.getIsBelow(best, candidate),
    true
  )
}

// 0x00439240 (the stack argument is 1 for a taunt line): a voice line every 5 s or more, sound `+0xd40 + r % 6 (+ 6)`.
export const playRacerVoice = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  isTaunt: boolean
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  if (racer.voiceMilliseconds !== 0) return racerSet
  const voice = drawRandomRemainder(
    context.tables.randomTable,
    racerSet.randomPosition,
    VOICE_VARIANTS
  )
  const delay = drawRandomValue(context.tables.randomTable, voice.position)
  const updated = setRacer(
    racerSet,
    racerIndex,
    Object.freeze({
      ...racer,
      voiceMilliseconds: delay.value * 4 + VOICE_MINIMUM_MILLISECONDS,
    })
  )
  const sounded: RacerSet = Object.freeze({
    ...updated,
    sounds: Object.freeze([
      ...updated.sounds,
      {
        soundId: racer.voiceBase + voice.value + (isTaunt ? VOICE_VARIANTS : 0),
        address: '0x004392ff',
        racerIndex,
      },
    ]),
  })
  return setRandomPosition(sounded, delay.position)
}

// 0x0043a210 (thiscall: race position).
const setRacePosition = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  racePosition: number
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  const isChanged = (racer.flags & FINISHED_FLAG) === 0 && racePosition !== racer.racePosition
  const voiced = isChanged
    ? playRacerVoice(context, racerSet, racerIndex, racePosition < racer.racePosition)
    : racerSet
  return setRacer(
    voiced,
    racerIndex,
    Object.freeze({ ...getRacer(voiced, racerIndex), racePosition })
  )
}

// Pass 8 of RacerSet_Step, 0x0043c1b0 up to 0x0043c488: ranks the racers by progress and sets their positions.
// The ranking array is the static 0x004c67b0 (stride 12: racer, distance, progress); its distances are only read
// after being written in the same call, so a fresh array gives the same result.
export const rankRacers = (context: RacerSetContext, racerSet: RacerSet): RacerSet => {
  const count = racerSet.racers.length
  const filled: readonly RankingEntry[] = racerSet.racers.map((racer, racerIndex) =>
    Object.freeze({
      racerIndex,
      progress: context.arithmetic.storeFloat(getRacerSetProgress(context, racer)),
      distance: 0,
    })
  )
  const byProgress = sortByKey(
    filled,
    0,
    count,
    (entry) => entry.progress,
    (candidate, best) => context.arithmetic.getIsBelow(candidate, best),
    false
  )
  const ranked = Array.from({ length: Math.max(count - 1, 0) }, (_, index) => index).reduce(
    (entries, start) => breakTie(context, racerSet, entries, start),
    byProgress
  )
  return ranked.reduce((current, entry, index) => {
    const racer = getRacer(current, entry.racerIndex)
    if ((racer.flags & UNRANKED_FLAG) !== 0) return current
    return setRacePosition(context, current, entry.racerIndex, count - index)
  }, racerSet)
}
