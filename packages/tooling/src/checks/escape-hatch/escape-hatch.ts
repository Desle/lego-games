import type { CheckId } from '../check.types.ts'

const escapeRegularExpression = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const getEscapeHatchComment = (checkId: CheckId): string =>
  `// @check-allow ${checkId}: <reason>`

// An exception sits on the offending line or the line above it, and must carry a reason.
export const getIsAllowedByEscapeHatch = (
  content: string,
  lineNumber: number,
  checkId: CheckId
): boolean => {
  const pattern = new RegExp(`@check-allow\\s+${escapeRegularExpression(checkId)}\\s*:\\s*\\S`)
  const lines = content.split('\n')
  return [lines[lineNumber - 1], lines[lineNumber - 2]].some((line) => pattern.test(line ?? ''))
}
