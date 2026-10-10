import { EnvironmentName, type Environment, type EnvironmentSource } from './environment.types.ts'

const ENVIRONMENT_NAMES: readonly string[] = Object.values(EnvironmentName)

const getIsEnvironmentName = (value: string): value is EnvironmentName =>
  ENVIRONMENT_NAMES.includes(value)

const getEnvironmentName = (rawName: string | undefined): EnvironmentName => {
  if (rawName === undefined || rawName === '') return EnvironmentName.DEVELOPMENT
  if (!getIsEnvironmentName(rawName)) {
    throw new Error(
      `NODE_ENV must be one of ${ENVIRONMENT_NAMES.join(', ')}, received "${rawName}"`
    )
  }
  return rawName
}

export const getEnvironment = (source: EnvironmentSource = process.env): Environment =>
  Object.freeze({ name: getEnvironmentName(source['NODE_ENV']) })
