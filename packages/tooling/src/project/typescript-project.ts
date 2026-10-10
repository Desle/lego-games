import { join } from 'node:path'
import typescript from 'typescript'
import type { ResolvedToolingConfig } from '../config/tooling-config.types.ts'
import { toProjectPath } from './project-files.ts'
import type { TypescriptProject } from './typescript-project.types.ts'

export const loadTypescriptProject = (
  root: string,
  config: ResolvedToolingConfig
): TypescriptProject => {
  const errors: string[] = []
  const host: typescript.ParseConfigFileHost = {
    ...typescript.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) =>
      void errors.push(typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
  }
  const extraFileExtensions = config.typecheckedExtraExtensions.map((extension) => ({
    extension: extension.replace(/^\./, ''),
    isMixedContent: true,
    scriptKind: typescript.ScriptKind.Deferred,
  }))
  const parsed = typescript.getParsedCommandLineOfConfigFile(
    join(root, config.tsconfigPath),
    {},
    host,
    undefined,
    undefined,
    extraFileExtensions
  )
  return Object.freeze({
    fileNames: new Set((parsed?.fileNames ?? []).map((fileName) => toProjectPath(root, fileName))),
    compilerOptions: parsed?.options ?? {},
    errors,
  })
}
