import { getIsGitRepository, getIsShallowClone, getIsTracked, runGit } from '../../project/git.ts'
import { CheckId, type Check, type CheckContext, type Violation } from '../check.types.ts'
import type { TodoAge } from './stale-todos.types.ts'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const TODO_MARKER = /\b(TODO|FIXME)\b/
const AUTHOR_TIME_PREFIX = 'author-time '

// --line-porcelain repeats the commit header before every line; uncommitted lines carry the current time.
export const getTodoAges = (blame: string, now: number): readonly TodoAge[] => {
  const ages: TodoAge[] = []
  let authorTimeInSeconds = now / 1000
  let line = 0
  for (const blameLine of blame.split('\n')) {
    if (blameLine.startsWith(AUTHOR_TIME_PREFIX)) {
      authorTimeInSeconds = Number(blameLine.slice(AUTHOR_TIME_PREFIX.length))
    }
    if (!blameLine.startsWith('\t')) continue
    line += 1
    if (!TODO_MARKER.test(blameLine)) continue
    ages.push({
      line,
      ageInDays: Math.floor((now - authorTimeInSeconds * 1000) / MILLISECONDS_PER_DAY),
    })
  }
  return ages
}

const runStaleTodos = (context: CheckContext): Promise<readonly Violation[]> => {
  const pathsWithTodos = [...context.sourceFiles]
    .filter(([, content]) => TODO_MARKER.test(content))
    .map(([path]) => path)
  if (pathsWithTodos.length === 0) return Promise.resolve([])
  if (!getIsGitRepository(context.root)) {
    return Promise.resolve([
      { path: '.', line: null, message: 'not a git repository, so TODO ages cannot be checked' },
    ])
  }
  if (getIsShallowClone(context.root)) {
    return Promise.resolve([
      {
        path: '.',
        line: null,
        message: 'shallow clone: git blame cannot date TODOs (use fetch-depth: 0 in CI)',
      },
    ])
  }
  const now = Date.now()
  const maximumAge = context.config.maximumTodoAgeInDays
  return Promise.resolve(
    pathsWithTodos.flatMap((path): readonly Violation[] => {
      if (!getIsTracked(context.root, path)) return []
      const blame = runGit(context.root, ['blame', '--line-porcelain', '--', path])
      if (blame.status !== 0) {
        return [{ path, line: null, message: `git blame failed: ${blame.stderr.trim()}` }]
      }
      return getTodoAges(blame.stdout, now)
        .filter((age) => age.ageInDays > maximumAge)
        .map((age) => ({
          path,
          line: age.line,
          message: `TODO is ${String(age.ageInDays)} days old (limit ${String(maximumAge)})`,
        }))
    })
  )
}

export const staleTodosCheck: Check = {
  id: CheckId.STALE_TODOS,
  description:
    'No TODO or FIXME line outlives maximumTodoAgeInDays, dated per line with git blame.',
  fix: 'Do the work, or delete the marker and track it as an issue.',
  run: runStaleTodos,
}
