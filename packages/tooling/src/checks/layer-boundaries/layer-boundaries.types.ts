import type typescript from 'typescript'

export type Location =
  | { readonly area: 'module'; readonly module: string; readonly layer: string }
  | { readonly area: 'shared' }
  | { readonly area: 'composition' }
  | { readonly area: 'outside' }

export type ResolvedImport =
  | { readonly kind: 'project'; readonly path: string }
  | { readonly kind: 'package'; readonly name: string }

export type LayerRules = {
  readonly sourceDirectory: string
  readonly sharedDirectories: readonly string[]
  readonly layers: Readonly<Record<string, readonly string[]>>
  readonly frameworkFreeLayers: readonly string[]
  readonly forbiddenImports: readonly string[]
}

export type ImportResolver = (specifier: string, importerPath: string) => ResolvedImport

export type ImportSpecifier = {
  readonly specifier: string
  readonly node: typescript.Node
}
