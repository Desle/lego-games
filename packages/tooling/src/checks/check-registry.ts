import { ProjectKind } from '../project/workspace/workspace.types.ts'
import type { Check } from './check.types.ts'
import { featureSpecsCheck } from './feature-specs/feature-specs.ts'
import { gateWiringCheck } from './gate-wiring/gate-wiring.ts'
import { layerBoundariesCheck } from './layer-boundaries/layer-boundaries.ts'
import { sourceCoverageCheck } from './source-coverage/source-coverage.ts'
import { staleTodosCheck } from './stale-todos/stale-todos.ts'
import { tracedConstantsCheck } from './traced-constants/traced-constants.ts'
import { trackedSymlinksCheck } from './tracked-symlinks/tracked-symlinks.ts'
import { typesInTypesFilesCheck } from './types-in-types-files/types-in-types-files.ts'

export const CHECKS: readonly Check[] = [
  gateWiringCheck,
  sourceCoverageCheck,
  layerBoundariesCheck,
  typesInTypesFilesCheck,
  featureSpecsCheck,
  staleTodosCheck,
]

// A workspace root holds no source of its own: its packages run the source checks themselves.
const WORKSPACE_ROOT_CHECKS: readonly Check[] = [
  gateWiringCheck,
  trackedSymlinksCheck,
  tracedConstantsCheck,
]

export const getChecks = (kind: ProjectKind): readonly Check[] =>
  kind === ProjectKind.WORKSPACE_ROOT ? WORKSPACE_ROOT_CHECKS : CHECKS
