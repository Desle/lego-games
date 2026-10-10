import { readFileSync } from 'node:fs'

export const readHookInput = (): Readonly<Record<string, unknown>> => {
  try {
    const input: unknown = JSON.parse(readFileSync(0, 'utf8'))
    return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
