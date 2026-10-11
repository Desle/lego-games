import { getRestartedForceFeedback } from '../../types/force-feedback/force-feedback.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type { RacerBoundary } from '../../types/racer.types.ts'

const CONTACT_STRENGTH = 100

// 0x00422100 (thiscall on racer +0x14, the force-feedback effect): while the car body touches the world, a
// device that is present and idle (+0x18 is 0) restarts its effect with strength 100.
export const notifyRacerContact: RacerBoundary = (_context, racerSet, racerIndex) => {
  const racer = getRacer(racerSet, racerIndex)
  if (racer.forceFeedback.state !== 0) return racerSet
  return setRacer(
    racerSet,
    racerIndex,
    Object.freeze({
      ...racer,
      forceFeedback: getRestartedForceFeedback(racer.forceFeedback, CONTACT_STRENGTH),
    })
  )
}
