import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getHasExtension,
  getIsTestFile,
  listProjectFiles,
  readOptionalProjectFile,
  readProjectFile,
} from '../../project/project-files.ts'
import { findConstantLiterals } from './find-constant-literals.ts'
import type {
  ConstantLiteral,
  TracedConstantsBaseline,
  TracedConstantsBaselineEntry,
  TracedConstantsProblem,
} from './traced-constants.types.ts'

export const TRACED_DIRECTORIES: readonly string[] = ['packages/lego-racers/src/modules']
export const BASELINE_PATH = 'traced-constants-baseline.json'
export const BASELINE_COMMAND = 'pnpm run traced-constants:baseline'

const getIsTracedFile = (path: string) =>
  getHasExtension(path, ['.ts', '.tsx']) &&
  !path.endsWith('.d.ts') &&
  !getIsTestFile(path) &&
  !/(^|\/)(fixtures?|__fixtures__)\//.test(path) &&
  !/\.fixtures?\.[cm]?tsx?$/.test(path)

export const listTracedLiterals = (root: string): readonly ConstantLiteral[] =>
  TRACED_DIRECTORIES.flatMap((directory) =>
    listProjectFiles(root, directory)
      .filter(getIsTracedFile)
      .flatMap((path) => findConstantLiterals(path, readProjectFile(root, path)))
  )

const getKey = (entry: Pick<ConstantLiteral, 'path' | 'scope' | 'literal'>) =>
  JSON.stringify([entry.path, entry.scope, entry.literal])

export const countLiterals = (
  literals: readonly ConstantLiteral[]
): ReadonlyMap<string, readonly ConstantLiteral[]> => {
  const groups = new Map<string, ConstantLiteral[]>()
  for (const literal of literals)
    groups.set(getKey(literal), [...(groups.get(getKey(literal)) ?? []), literal])
  return groups
}

export const createBaseline = (literals: readonly ConstantLiteral[]): TracedConstantsBaseline => ({
  entries: [...countLiterals(literals).values()]
    .map((group): TracedConstantsBaselineEntry => {
      const [first] = group
      return {
        path: first?.path ?? '',
        scope: first?.scope ?? '',
        literal: first?.literal ?? '',
        count: group.length,
      }
    })
    .sort((left, right) => getKey(left).localeCompare(getKey(right))),
})

export const parseBaseline = (content: string | null): TracedConstantsBaseline => {
  if (content === null) return { entries: [] }
  const parsed: unknown = JSON.parse(content)
  const entries =
    typeof parsed === 'object' && parsed !== null && 'entries' in parsed ? parsed.entries : null
  if (!Array.isArray(entries)) throw new Error(`${BASELINE_PATH} has no 'entries' array`)
  return { entries: entries as readonly TracedConstantsBaselineEntry[] }
}

// New literals fail; baseline slack (a literal that was fixed or moved) fails too, so it can never hide a new one.
export const findBaselineProblems = (
  literals: readonly ConstantLiteral[],
  baseline: TracedConstantsBaseline
): readonly TracedConstantsProblem[] => {
  const allowedCounts = new Map(baseline.entries.map((entry) => [getKey(entry), entry.count]))
  const groups = countLiterals(literals)
  const unexplained = [...groups].flatMap(([key, group]): readonly TracedConstantsProblem[] => {
    const allowedCount = allowedCounts.get(key) ?? 0
    if (group.length <= allowedCount) return []
    return group.map((literal) => ({
      path: literal.path,
      line: literal.line,
      message: `numeric literal ${literal.literal}${literal.scope === '' ? '' : ` in ${literal.scope}`} has no original address`,
    }))
  })
  const stale = baseline.entries
    .filter((entry) => (groups.get(getKey(entry))?.length ?? 0) < entry.count)
    .map((entry) => ({
      path: entry.path,
      line: null,
      message: `baseline lists ${String(entry.count)} x ${entry.literal} in ${entry.scope === '' ? '(file scope)' : entry.scope}, the code has fewer: run ${BASELINE_COMMAND}`,
    }))
  return [...unexplained, ...stale]
}

// Only ever shrinks an existing baseline; a new literal must be traced, not baselined.
export const refreshBaseline = (root: string): readonly TracedConstantsProblem[] => {
  const literals = listTracedLiterals(root)
  const existingContent = readOptionalProjectFile(root, BASELINE_PATH)
  if (existingContent !== null) {
    const unexplained = findBaselineProblems(literals, parseBaseline(existingContent)).filter(
      (problem) => problem.line !== null
    )
    if (unexplained.length > 0) return unexplained
  }
  writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify(createBaseline(literals), null, 2)}\n`)
  return []
}
