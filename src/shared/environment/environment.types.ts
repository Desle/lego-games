import { createEnum, type EnumValues } from '../types/enum.types.ts'

export const EnvironmentName = createEnum({
  DEVELOPMENT: 'development',
  TEST: 'test',
  PRODUCTION: 'production',
})
export type EnvironmentName = EnumValues<typeof EnvironmentName>

export type Environment = {
  readonly name: EnvironmentName
}

export type EnvironmentSource = Readonly<Record<string, string | undefined>>
