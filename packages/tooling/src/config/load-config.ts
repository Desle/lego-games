import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ToolingConfigModule, ResolvedToolingConfig } from './tooling-config.types.ts'
import { resolveConfig } from './resolve-config/resolve-config.ts'

export const CONFIG_FILE_NAME = 'tooling.config.ts'

export const loadConfig = async (root: string): Promise<ResolvedToolingConfig> => {
  const path = join(root, CONFIG_FILE_NAME)
  if (!existsSync(path)) return resolveConfig({})
  const loaded = (await import(pathToFileURL(path).href)) as ToolingConfigModule
  if (typeof loaded.default !== 'object') {
    throw new Error(`${CONFIG_FILE_NAME} must default-export defineToolingConfig({ … })`)
  }
  return resolveConfig(loaded.default)
}
