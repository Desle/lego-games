import type { SoundBank } from '../../types/audio.types.ts'
import { readJamTextLine } from '../../types/jam-text-line/jam-text-line.ts'

const PATH_BUFFER_LENGTH = 0x104
const COUNT_BUFFER_LENGTH = 4
const WHITESPACE = new Set([' ', '\t', '\n', '\v', '\f', '\r'])

// The C runtime atoi: leading whitespace, an optional sign, then decimal digits.
const parseInteger = (text: string): number => {
  let index = 0
  while (index < text.length && WHITESPACE.has(text.charAt(index))) index++
  const sign = text.charAt(index)
  const isNegative = sign === '-'
  if (isNegative || sign === '+') index++
  let value = 0
  while (index < text.length && text.charAt(index) >= '0' && text.charAt(index) <= '9') {
    value = value * 10 + Number(text.charAt(index))
    index++
  }
  return isNegative ? -value : value
}

// 0x0041b5d0 lowercases only A-Z.
const getLowercaseName = (name: string): string =>
  name.replace(/[A-Z]/g, (letter) => letter.toLowerCase())

// 0x0041ae60: a directory line, a count line, then one sound file name per line.
export const decodeSoundBank = (bytes: Uint8Array): SoundBank => {
  let position = 0
  const readLine = (maximumLength: number): string | undefined => {
    const line = readJamTextLine(bytes, position, maximumLength)
    if (line === undefined) return undefined
    position += line.consumedByteCount
    return line.text
  }

  const directory = readLine(PATH_BUFFER_LENGTH) ?? ''
  const declaredSoundCount = parseInteger(readLine(COUNT_BUFFER_LENGTH) ?? '')
  const soundPaths: string[] = []
  for (let index = 0; index < declaredSoundCount; index++) {
    const name = readLine(PATH_BUFFER_LENGTH)
    // 0x0041b5f0 joins into a 0x104-byte buffer; a name that cannot be read leaves the path empty.
    soundPaths.push(
      name === undefined
        ? ''
        : (directory + getLowercaseName(name)).slice(0, PATH_BUFFER_LENGTH - 1)
    )
  }
  return Object.freeze({
    directory,
    declaredSoundCount,
    soundPaths: Object.freeze(soundPaths),
  })
}
