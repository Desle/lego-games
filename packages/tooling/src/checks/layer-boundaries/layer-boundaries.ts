import { isBuiltin } from 'node:module'
import { dirname, join, normalize } from 'node:path'
import typescript from 'typescript'
import { toProjectPath } from '../../project/project-files.ts'
import { getLineNumber, parseSource, visitAllNodes } from '../../project/parse-source.ts'
import { CheckId, type Check, type CheckContext, type Violation } from '../check.types.ts'
import { getEscapeHatchComment, getIsAllowedByEscapeHatch } from '../escape-hatch/escape-hatch.ts'
import type {
  ImportResolver,
  ImportSpecifier,
  LayerRules,
  Location,
  ResolvedImport,
} from './layer-boundaries.types.ts'

const MODULE_INDEX = 'index'
const MODULE_ROOT_FILE = 'module-root'

const getLocation = (path: string, rules: LayerRules): Location => {
  const prefix = `${rules.sourceDirectory}/`
  if (!path.startsWith(prefix)) return { area: 'outside' }
  const segments = path.slice(prefix.length).split('/')
  const isInSharedDirectory =
    segments.length > 1 && rules.sharedDirectories.includes(segments[0] ?? '')
  if (isInSharedDirectory) return { area: 'shared' }
  if (segments[0] !== 'modules' || segments.length < 2) return { area: 'composition' }
  const module = segments[1] ?? ''
  if (segments.length === 2) return { area: 'module', module, layer: MODULE_INDEX }
  const isRootFile = segments.length === 3
  const isIndexFile = isRootFile && /^index(\.[cm]?[jt]sx?)?$/.test(segments[2] ?? '')
  const rootLayer = isIndexFile ? MODULE_INDEX : MODULE_ROOT_FILE
  return { area: 'module', module, layer: isRootFile ? rootLayer : (segments[2] ?? '') }
}

const getImportSpecifiers = (sourceFile: typescript.SourceFile): readonly ImportSpecifier[] => {
  const specifiers: ImportSpecifier[] = []
  visitAllNodes(sourceFile, (node) => {
    const isStaticImport =
      (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    if (isStaticImport && typescript.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push({ specifier: node.moduleSpecifier.text, node })
    }
    const isDynamicImport =
      typescript.isCallExpression(node) &&
      node.expression.kind === typescript.SyntaxKind.ImportKeyword
    const [firstArgument] = isDynamicImport ? node.arguments : []
    if (firstArgument !== undefined && typescript.isStringLiteralLike(firstArgument)) {
      specifiers.push({ specifier: firstArgument.text, node })
    }
  })
  return specifiers
}

export const resolveByPath: ImportResolver = (specifier, importerPath) =>
  specifier.startsWith('.')
    ? { kind: 'project', path: normalize(join(dirname(importerPath), specifier)) }
    : { kind: 'package', name: specifier }

export const createTypescriptResolver =
  (root: string, compilerOptions: typescript.CompilerOptions): ImportResolver =>
  (specifier, importerPath) => {
    if (isBuiltin(specifier)) return { kind: 'package', name: specifier }
    const { resolvedModule } = typescript.resolveModuleName(
      specifier,
      join(root, importerPath),
      compilerOptions,
      typescript.sys
    )
    if (resolvedModule === undefined) return resolveByPath(specifier, importerPath)
    return resolvedModule.isExternalLibraryImport === true
      ? { kind: 'package', name: specifier }
      : { kind: 'project', path: toProjectPath(root, resolvedModule.resolvedFileName) }
  }

const getImportProblem = (
  importerPath: string,
  resolved: ResolvedImport,
  rules: LayerRules
): string | null => {
  const importer = getLocation(importerPath, rules)
  if (importer.area === 'module' && importer.layer === MODULE_ROOT_FILE) {
    return `only index.ts may sit at the root of modules/${importer.module}; move this file into a layer folder`
  }
  const isKnownLayer =
    importer.area === 'module' &&
    (importer.layer in rules.layers || importer.layer === MODULE_INDEX)
  if (importer.area === 'module' && !isKnownLayer) {
    return `unknown layer folder '${importer.layer}' — use one of: ${Object.keys(rules.layers).join(', ')}`
  }
  if (resolved.kind === 'package') {
    const isFrameworkFree =
      importer.area === 'module' && rules.frameworkFreeLayers.includes(importer.layer)
    return isFrameworkFree
      ? `the ${importer.layer} layer must stay framework-free, but imports '${resolved.name}'`
      : null
  }
  const target = getLocation(resolved.path, rules)
  if (target.area === 'shared' || target.area === 'outside' || importer.area === 'outside')
    return null
  if (target.area === 'composition') {
    return importer.area === 'composition'
      ? null
      : `only the composition root may import ${resolved.path}; if that folder is shared UI or utilities, add it to sharedDirectories in tooling.config.ts`
  }
  if (importer.area === 'shared') return 'shared code must not import from modules'
  const isSameModule = importer.area === 'module' && importer.module === target.module
  if (!isSameModule) {
    return target.layer === MODULE_INDEX
      ? null
      : `import modules/${target.module} through its index.ts, not its internals`
  }
  if (importer.layer === MODULE_INDEX || importer.layer === target.layer) return null
  const allowedLayers = rules.layers[importer.layer] ?? []
  return allowedLayers.includes(target.layer)
    ? null
    : `the ${importer.layer} layer may not import the ${target.layer} layer (allowed: ${allowedLayers.join(', ') || 'none'})`
}

// Another workspace package is imported by its name, never through a relative path out of this one.
const getPackageBoundaryProblem = (
  specifier: string,
  resolved: ResolvedImport,
  rules: LayerRules
): string | null => {
  const isForbidden = rules.forbiddenImports.some((name) => specifier.startsWith(name))
  if (isForbidden) {
    return `this package must never import '${specifier}' (forbiddenImports in tooling.config.ts)`
  }
  const isOutsidePackage =
    specifier.startsWith('.') && resolved.kind === 'project' && resolved.path.startsWith('../')
  return isOutsidePackage
    ? `'${specifier}' reaches outside this package; import the other package by its name`
    : null
}

export const findLayerViolations = (
  files: ReadonlyMap<string, string>,
  rules: LayerRules,
  resolve: ImportResolver
): readonly Violation[] =>
  [...files].flatMap(([path, content]) => {
    const sourceFile = parseSource(path, content)
    return getImportSpecifiers(sourceFile).flatMap(({ specifier, node }) => {
      const line = getLineNumber(sourceFile, node)
      if (getIsAllowedByEscapeHatch(sourceFile.text, line, CheckId.LAYER_BOUNDARIES)) return []
      const resolved = resolve(specifier, path)
      const problem =
        getPackageBoundaryProblem(specifier, resolved, rules) ??
        getImportProblem(path, resolved, rules)
      return problem === null ? [] : [{ path, line, message: problem }]
    })
  })

const runLayerBoundaries = (context: CheckContext): Promise<readonly Violation[]> =>
  Promise.resolve(
    findLayerViolations(
      context.sourceFiles,
      context.config,
      createTypescriptResolver(context.root, context.typescriptProject.compilerOptions)
    )
  )

export const layerBoundariesCheck: Check = {
  id: CheckId.LAYER_BOUNDARIES,
  description:
    'Modules are imported only through their index.ts; layers point inward; framework-free layers import no packages; src/shared never imports modules; a package imports no forbidden package and reaches no other package by a relative path.',
  fix: `Restructure the dependency (see the layer table in AGENTS.md), or add '${getEscapeHatchComment(CheckId.LAYER_BOUNDARIES)}'.`,
  run: runLayerBoundaries,
}
