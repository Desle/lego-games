import type { ToolingConfig, ResolvedToolingConfig } from '../tooling-config.types.ts'

export const DEFAULT_LAYERS: Readonly<Record<string, readonly string[]>> = {
  types: [],
  events: ['types'],
  services: ['types'],
  controller: ['types', 'services', 'events'],
  transport: ['controller', 'types'],
  views: ['controller', 'components', 'providers', 'types'],
  components: ['controller', 'providers', 'types'],
  providers: ['controller', 'types'],
}

export const DEFAULT_CONFIG: ResolvedToolingConfig = {
  sourceDirectory: 'src',
  sourceExtensions: ['.ts'],
  nonSourceExtensions: [],
  typecheckedExtraExtensions: [],
  tsconfigPath: 'tsconfig.json',
  sharedDirectories: ['shared'],
  layers: DEFAULT_LAYERS,
  frameworkFreeLayers: ['types'],
  maximumTodoAgeInDays: 90,
  specsDirectory: '.docs/specs',
  requiredSpecSections: ['Behaviour', 'User flows', 'Invariants', 'Out of scope'],
  protectedBranches: ['main', 'master'],
  checkCommand: 'pnpm run check',
  ciCommand: 'pnpm run ci',
}

export const resolveConfig = (config: ToolingConfig): ResolvedToolingConfig =>
  Object.freeze({ ...DEFAULT_CONFIG, ...config })
