import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { getPhysicsSubSteps, getRaceTimeStep } from '../../types/race-time-step/race-time-step.ts'
import type { RacePhysicsSubStep, RaceTimeStepInput } from '../../types/racer-physics.types.ts'

// NOT YET PORTED: the body of one sub-step. The original runs RacerSet_Step 0x0043c030 (all racers),
// Camera_Update 0x00428540 per local player with (float)step, and GhostRecorder_RecordSample 0x00422710.
export const stepRaceSubStepNotYetPorted = <State>(state: State): State => state

// Race_Update 0x00435220, time handling only: the per-frame updates before and after the loop are not ported.
export const updateRacePhysics = <State>(
  arithmetic: FloatArithmetic,
  state: State,
  input: RaceTimeStepInput,
  stepSubStep: RacePhysicsSubStep<State>
): State =>
  getPhysicsSubSteps(getRaceTimeStep(arithmetic, input)).reduce(
    (current, stepMilliseconds) => stepSubStep(current, stepMilliseconds),
    state
  )
