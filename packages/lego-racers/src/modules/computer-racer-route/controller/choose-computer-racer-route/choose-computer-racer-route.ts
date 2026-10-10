import {
  ComputerRacerRouteLetter,
  FALLBACK_ROUTE_RACER,
  MAXIMUM_VARIANT_COUNT,
} from '../../types/computer-racer-route-keyword/computer-racer-route-keyword.ts'
import type {
  ComputerRacerRouteChoice,
  ComputerRacerRouteLetter as ComputerRacerRouteLetterValue,
  ComputerRacerRouteVariantCounts,
} from '../../types/computer-racer-route.types.ts'

const LETTERS: readonly ComputerRacerRouteLetterValue[] = Object.freeze([
  ComputerRacerRouteLetter.F,
  ComputerRacerRouteLetter.M,
  ComputerRacerRouteLetter.S,
])

const toDigit = (value: number) => String.fromCharCode(0x30 + value)

// 0x00433190 writes `r`, '0' + racer, `_`, letter, `_`, '0' + variant, `.rr` and `b` (JAM) or `f` (text).
export const getComputerRacerRouteFileName = (
  racerIndex: number,
  letter: ComputerRacerRouteLetterValue,
  variant: number,
  isJamArchive: boolean
): string => `r${toDigit(racerIndex)}_${letter}_${toDigit(variant)}.rr${isJamArchive ? 'b' : 'f'}`

// Per letter, the variants present from 0 upwards, at most ten (0x00433227..0x00433293).
export const countComputerRacerRouteVariants = (
  racerIndex: number,
  isJamArchive: boolean,
  getIsFilePresent: (fileName: string) => boolean
): ComputerRacerRouteVariantCounts => {
  const countLetter = (letter: ComputerRacerRouteLetterValue): number => {
    let count = 0
    while (
      count < MAXIMUM_VARIANT_COUNT &&
      getIsFilePresent(getComputerRacerRouteFileName(racerIndex, letter, count, isJamArchive))
    ) {
      count += 1
    }
    return count
  }
  return Object.freeze({
    f: countLetter(ComputerRacerRouteLetter.F),
    m: countLetter(ComputerRacerRouteLetter.M),
    s: countLetter(ComputerRacerRouteLetter.S),
  })
}

// 0x0043329d..0x00433314: one random-table draw modulo the total picks a letter and variant; no variants, no draw.
export const chooseComputerRacerRoute = (
  counts: ComputerRacerRouteVariantCounts,
  drawRandomValue: () => number
): ComputerRacerRouteChoice | null => {
  const total = counts.f + counts.m + counts.s
  if (total === 0) return null
  let remainder = drawRandomValue() % total
  for (const letter of LETTERS) {
    if (remainder < counts[letter] || letter === ComputerRacerRouteLetter.S) {
      return Object.freeze({ letter, variant: remainder })
    }
    remainder -= counts[letter]
  }
  return null
}

// 0x00433343: when no route slot holds samples, r1_f_0, r1_m_0 and r1_s_0 are tried for slot 0.
export const getFallbackComputerRacerRouteFileNames = (isJamArchive: boolean): readonly string[] =>
  Object.freeze(
    LETTERS.map((letter) =>
      getComputerRacerRouteFileName(FALLBACK_ROUTE_RACER, letter, 0, isJamArchive)
    )
  )
