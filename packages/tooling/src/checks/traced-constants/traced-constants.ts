import { CheckId, type Check } from '../check.types.ts'
import { getEscapeHatchComment } from '../escape-hatch/escape-hatch.ts'
import {
  BASELINE_COMMAND,
  BASELINE_PATH,
  findBaselineProblems,
  listTracedLiterals,
  parseBaseline,
} from './traced-constants-baseline.ts'
import { readOptionalProjectFile } from '../../project/project-files.ts'

export const tracedConstantsCheck: Check = {
  id: CheckId.TRACED_CONSTANTS,
  description:
    'Every numeric behaviour constant in lego-racers modules carries the original address it was read from.',
  fix: `Name the constant and cite its address on the same or previous line (\`const DRAG = 0.05 // float32 0.05 at 0x004b07f0\`), or add '${getEscapeHatchComment(CheckId.TRACED_CONSTANTS)}'. Never tune a number to fix a divergence; find the original. Do not add to ${BASELINE_PATH}; after tracing old literals run \`${BASELINE_COMMAND}\` to shrink it.`,
  run: (context) =>
    Promise.resolve(
      findBaselineProblems(
        listTracedLiterals(context.root),
        parseBaseline(readOptionalProjectFile(context.root, BASELINE_PATH))
      )
    ),
}
