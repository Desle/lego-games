import type { LDrawModelDescription } from './model-description.types.ts'

const FILE_LINE = /^0\s+FILE\s/i
const PART_LINE = /^1\s/

// The part count of a model's main file (the lines that place a part or a sub-model, up to the second `0 FILE` of an `.mpd`) and the
// comments that open it, without the `0` marker.
export const describeLDrawModel = (text: string): LDrawModelDescription => {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const secondFile = lines.findIndex((line, index) => index > 0 && FILE_LINE.test(line))
  const mainLines = secondFile === -1 ? lines : lines.slice(0, secondFile)
  const firstContent = mainLines.findIndex((line) => line !== '' && !line.startsWith('0'))
  const headerLines = mainLines
    .slice(0, firstContent === -1 ? mainLines.length : firstContent)
    .filter((line) => line.startsWith('0') && !FILE_LINE.test(line))
    .map((line) => line.slice(1).trim())
    .filter((line) => line !== '')
  return Object.freeze({
    partCount: mainLines.filter((line) => PART_LINE.test(line)).length,
    headerLines: Object.freeze(headerLines),
  })
}
