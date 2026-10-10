import { join } from 'node:path'
import { getHasExtension } from '../../project/project-files.ts'
import { CheckId, type Check, type CheckContext, type Violation } from '../check.types.ts'
import type { CoverageInput } from './source-coverage.types.ts'

export const DEFAULT_NON_SOURCE_EXTENSIONS: readonly string[] = [
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.json',
  '.md',
  '.mdx',
  '.txt',
  '.yml',
  '.yaml',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp4',
  '.mp3',
  '.wav',
  '.webm',
  '.pdf',
  '.wasm',
  '.snap',
]

export const findCoverageGaps = (input: CoverageInput): readonly Violation[] =>
  input.paths
    .filter((path) => !getHasExtension(path, input.nonSourceExtensions))
    .flatMap((path) => {
      const missing = [
        getHasExtension(path, input.scannedExtensions) ? null : 'the architecture checks',
        input.typecheckedPaths.has(path) ? null : 'TypeScript',
        input.lintedPaths.has(path) ? null : 'ESLint',
      ].filter((tool) => tool !== null)
      return missing.length === 0
        ? []
        : [
            {
              path,
              line: null,
              message: `not read by ${missing.join(', ')} — its rules are NOT enforced`,
            },
          ]
    })

const getLintedPaths = async (
  root: string,
  paths: readonly string[]
): Promise<ReadonlySet<string>> => {
  const { ESLint } = await import('eslint')
  const eslint = new ESLint({ cwd: root })
  const linted = await Promise.all(
    paths.map(async (path) => {
      const absolutePath = join(root, path)
      if (await eslint.isPathIgnored(absolutePath)) return null
      const config: unknown = await eslint.calculateConfigForFile(absolutePath)
      return config === undefined ? null : path
    })
  )
  return new Set(linted.filter((path) => path !== null))
}

const runSourceCoverage = async (context: CheckContext): Promise<readonly Violation[]> => {
  const nonSourceExtensions = [
    ...DEFAULT_NON_SOURCE_EXTENSIONS,
    ...context.config.nonSourceExtensions,
  ]
  const candidatePaths = context.allSourceDirectoryFiles.filter(
    (path) => !getHasExtension(path, nonSourceExtensions)
  )
  const tsconfigProblems = context.typescriptProject.errors.map((message) => ({
    path: context.config.tsconfigPath,
    line: null,
    message,
  }))
  return [
    ...tsconfigProblems,
    ...findCoverageGaps({
      paths: candidatePaths,
      scannedExtensions: context.config.sourceExtensions,
      nonSourceExtensions,
      typecheckedPaths: context.typescriptProject.fileNames,
      lintedPaths: await getLintedPaths(context.root, candidatePaths),
    }),
  ]
}

export const sourceCoverageCheck: Check = {
  id: CheckId.SOURCE_COVERAGE,
  description:
    'Every file under the source directory is parsed by the architecture checks, typechecked and linted — or declared non-source.',
  fix: 'Add the extension to sourceExtensions in tooling.config.ts AND make TypeScript (tsconfig include / vue-tsc) and ESLint (a config whose `files` match it) read it. If it is not code, add it to nonSourceExtensions.',
  run: runSourceCoverage,
}
