import typescript from 'typescript'
import { getIsTestFile, listProjectFiles, readProjectFile } from '../../project/project-files.ts'
import { parseSource, visitAllNodes } from '../../project/parse-source.ts'
import { CheckId, type Check, type CheckContext, type Violation } from '../check.types.ts'

export const SPEC_TEMPLATE_FILE_NAME = '_TEMPLATE.md'
const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'])
const DECLARED_ENDPOINT = /^-\s+`(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|ALL)\s+(\/\S*)`/gm
const PLACEHOLDER = /^_[^]*_$/

const getSections = (markdown: string): ReadonlyMap<string, string> =>
  new Map(
    markdown
      .split(/^## /m)
      .slice(1)
      .map((section) => {
        const [heading = '', ...body] = section.split('\n')
        return [heading.trim(), body.join('\n').trim()] as const
      })
  )

export const findSpecStructureProblems = (
  path: string,
  markdown: string,
  requiredSections: readonly string[]
): readonly Violation[] => {
  const sections = getSections(markdown)
  return requiredSections.flatMap((name) => {
    const body = sections.get(name)
    if (body === undefined) return [{ path, line: null, message: `missing section '## ${name}'` }]
    const isUnfilled = body === '' || PLACEHOLDER.test(body)
    return isUnfilled
      ? [{ path, line: null, message: `section '## ${name}' is still the template placeholder` }]
      : []
  })
}

export const getDeclaredEndpoints = (markdown: string): readonly string[] =>
  [...(getSections(markdown).get('Endpoints') ?? '').matchAll(DECLARED_ENDPOINT)].map(
    ([, method = '', route = '']) => `${method} ${route}`
  )

export const getRegisteredEndpoints = (files: ReadonlyMap<string, string>): ReadonlySet<string> => {
  const endpoints = new Set<string>()
  for (const [path, content] of files) {
    if (getIsTestFile(path)) continue
    visitAllNodes(parseSource(path, content), (node) => {
      if (
        !typescript.isCallExpression(node) ||
        !typescript.isPropertyAccessExpression(node.expression)
      )
        return
      const method = node.expression.name.text
      const [route] = node.arguments
      if (
        !ROUTE_METHODS.has(method) ||
        route === undefined ||
        !typescript.isStringLiteralLike(route)
      )
        return
      endpoints.add(`${method.toUpperCase()} ${route.text}`)
    })
  }
  return endpoints
}

/** Modules (folders directly under `<source>/modules/`) that have no `<specs>/<module>.md`. */
export const findModulesWithoutSpecs = (
  sourceFiles: readonly string[],
  sourceDirectory: string,
  specPaths: readonly string[],
  specsDirectory: string
): readonly Violation[] => {
  const prefix = `${sourceDirectory}/modules/`
  const modules = new Set(
    sourceFiles
      .filter((path) => path.startsWith(prefix) && path.slice(prefix.length).includes('/'))
      .map((path) => path.slice(prefix.length).split('/')[0] ?? '')
  )
  const specified = new Set(specPaths)
  return [...modules]
    .sort()
    .filter((module) => !specified.has(`${specsDirectory}/${module}.md`))
    .map((module) => ({
      path: `${prefix}${module}`,
      line: null,
      message: `has no spec; write ${specsDirectory}/${module}.md (pnpm run new:module scaffolds one)`,
    }))
}

const runFeatureSpecs = (context: CheckContext): Promise<readonly Violation[]> => {
  const specPaths = listProjectFiles(context.root, context.config.specsDirectory).filter(
    (path) => path.endsWith('.md') && !path.endsWith(SPEC_TEMPLATE_FILE_NAME)
  )
  const registered = getRegisteredEndpoints(context.sourceFiles)
  const modulesWithoutSpecs = findModulesWithoutSpecs(
    context.allSourceDirectoryFiles,
    context.config.sourceDirectory,
    specPaths,
    context.config.specsDirectory
  )
  return Promise.resolve([
    ...modulesWithoutSpecs,
    ...specPaths.flatMap((path) => {
      const markdown = readProjectFile(context.root, path)
      const missingEndpoints = getDeclaredEndpoints(markdown)
        .filter((endpoint) => !registered.has(endpoint))
        .map((endpoint) => ({
          path,
          line: null,
          message: `declares ${endpoint}, but no route registers that exact path`,
        }))
      return [
        ...findSpecStructureProblems(path, markdown, context.config.requiredSpecSections),
        ...missingEndpoints,
      ]
    }),
  ])
}

export const featureSpecsCheck: Check = {
  id: CheckId.FEATURE_SPECS,
  description:
    'Every module has a spec, every spec fills in its required sections, and every endpoint it declares is registered in code.',
  fix: 'Write or fill in the spec (it is what agents code against), or register the declared route with that exact path.',
  run: runFeatureSpecs,
}
