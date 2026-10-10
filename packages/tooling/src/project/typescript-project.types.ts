import type typescript from 'typescript'

export type TypescriptProject = {
  readonly fileNames: ReadonlySet<string>
  readonly compilerOptions: typescript.CompilerOptions
  readonly errors: readonly string[]
}

/** A top-level statement that may declare a name (function, class, type…). */
export type NamedStatement = typescript.Statement & { readonly name?: typescript.Identifier }
