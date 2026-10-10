import { UnportableCheckpointsError } from '../../types/checkpoint-errors/checkpoint-errors.ts'
import { NO_LINK, UNASSIGNED_PROGRESS } from '../../types/checkpoint-keyword/checkpoint-keyword.ts'
import type { CheckpointMerge } from '../../types/checkpoint.types.ts'

// x87 sums stay in a register between stores (53-bit precision under the CRT control word); stores round to float32.
const store = (value: number) => Math.fround(value)

const createLinkReader = (links: readonly (readonly number[])[]) => {
  const getLink = (checkpoint: number, slot: number): number => {
    const link = links[checkpoint]?.[slot]
    if (link === undefined || link >= links.length) {
      throw new UnportableCheckpointsError(
        `Checkpoint ${String(checkpoint)} links outside the checkpoint array`
      )
    }
    return link
  }
  return getLink
}

const failEndlessWalk = (): never => {
  throw new UnportableCheckpointsError('The checkpoint walk never ends in the original')
}

// LEGORacers.exe 0x0041e950: progress 0..1 along the loop of next links from checkpoint 0, then branches.
export const assignCheckpointProgress = (
  links: readonly (readonly number[])[]
): readonly number[] => {
  const count = links.length
  if (count === 0) {
    throw new UnportableCheckpointsError('The original walks an empty checkpoint array')
  }
  const getLink = createLinkReader(links)
  const progress: number[] = Array.from({ length: count }, () => UNASSIGNED_PROGRESS)

  // 0x0041ea60: the length of the next-link loop from checkpoint 0, at most the count.
  let loopLength = 0
  let node = 0
  do {
    loopLength += 1
    node = getLink(node, 0)
  } while (node !== 0 && loopLength < count)

  // 0x0041e964..0x0041e9a3.
  const step = store(1 / loopLength)
  let sum = 0
  node = 0
  for (;;) {
    progress[node] = store(sum)
    sum += step
    node = getLink(node, 0)
    if (node === 0 || !(sum < 1)) break
  }

  // 0x0041ea90: follow next links while unassigned, at most the count; returns where the walk stopped.
  const findMerge = (start: number): CheckpointMerge => {
    let merge = start
    let stepCount = 0
    while (progress[merge] === UNASSIGNED_PROGRESS && stepCount < count) {
      stepCount += 1
      merge = getLink(merge, 0)
    }
    return Object.freeze({ merge, stepCount })
  }

  // 0x0041e9a9..0x0041ea4a: each branch link spreads progress evenly up to where it rejoins.
  let mainNode = 0
  let mainStepCount = 0
  do {
    for (let slot = 1; slot < 4; slot++) {
      if (links[mainNode]?.[slot] === NO_LINK) continue
      const link = getLink(mainNode, slot)
      const { merge, stepCount } = findMerge(link)
      const delta = ((progress[merge] ?? 0) - (progress[mainNode] ?? 0)) / (stepCount + 1)
      let branchSum = (progress[mainNode] ?? 0) + delta
      let branchNode = link
      let branchStepCount = 0
      do {
        progress[branchNode] = store(branchSum)
        branchSum += delta
        branchNode = getLink(branchNode, 0)
        branchStepCount += 1
        if (branchStepCount > count) failEndlessWalk()
      } while (branchNode !== merge)
    }
    mainNode = getLink(mainNode, 0)
    mainStepCount += 1
    if (mainStepCount > count) failEndlessWalk()
  } while (mainNode !== 0)

  return Object.freeze(progress)
}
