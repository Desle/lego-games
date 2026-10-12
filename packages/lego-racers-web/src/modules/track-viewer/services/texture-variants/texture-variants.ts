import { DEVELOPMENT_HIGH_DEFINITION_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'

const getIsNameList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

// The pack folders the dev server finds; none when it offers no route (a production build).
export const getTextureVariants = async (): Promise<readonly string[]> => {
  const response = await fetch(`${DEVELOPMENT_HIGH_DEFINITION_ROUTE}/`).catch(() => null)
  if (response === null || !response.ok) return []
  const names: unknown = await response.json().catch(() => null)
  return getIsNameList(names) ? names : []
}
