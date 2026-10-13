import { MINIFIG_GEOMETRY } from '../minifig-geometry/minifig-geometry.ts'
import { MinifigRole } from './minifig-roles.types.ts'
import type { MinifigPartPlacement, MinifigPartWithRole } from './minifig-roles.types.ts'

const SIDED_ARM = 'arm'
const SIDED_HAND = 'hand'

// The library's minifigure parts by number (older numbers too, prints and assemblies included); a sided part with no side of its own
// in its number takes the side it sits on (the figure's left is +x).
const PART_NUMBER_ROLES: readonly (readonly [
  RegExp,
  MinifigRole | typeof SIDED_ARM | typeof SIDED_HAND,
])[] = [
  [/^3626/, MinifigRole.HEAD],
  [/^(?:973|76382)/, MinifigRole.TORSO],
  [/^(?:3815|970)/, MinifigRole.HIPS],
  [/^(?:3817|972)/, MinifigRole.LEFT_LEG],
  [/^(?:3816|971|2532)/, MinifigRole.RIGHT_LEG],
  [/^(?:3818|3819|981|982)/, SIDED_ARM],
  [/^(?:3820|983|2531)/, SIDED_HAND],
]

const getPartNumber = (partName: string): string =>
  (partName.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/\.dat$/, '')

export const findMinifigRole = (text: string): MinifigRole | null =>
  Object.values(MinifigRole).find((role) => role === text.trim().toLowerCase()) ?? null

// A part's role by its number; a part that is no minifigure part is worn on the head when it sits above the neck, else on the torso.
export const getMinifigPartRole = (part: MinifigPartPlacement): MinifigRole => {
  const number = getPartNumber(part.partName)
  const known = PART_NUMBER_ROLES.find(([pattern]) => pattern.test(number))?.[1]
  const isLeft = part.position[0] >= 0
  if (known === SIDED_ARM) return isLeft ? MinifigRole.LEFT_ARM : MinifigRole.RIGHT_ARM
  if (known === SIDED_HAND) return isLeft ? MinifigRole.LEFT_HAND : MinifigRole.RIGHT_HAND
  if (known !== undefined) return known
  return part.position[1] < MINIFIG_GEOMETRY.neck.pivot.y ? MinifigRole.HAT : MinifigRole.TORSO
}

// Each part of a figure with its role: the caller's hint for it (by the part's index), else what its number or place says.
export const getMinifigRoles = <Part extends MinifigPartPlacement>(
  parts: readonly Part[],
  roleHints: ReadonlyMap<number, MinifigRole> = new Map()
): readonly MinifigPartWithRole<Part>[] =>
  Object.freeze(
    parts.map((part, index) =>
      Object.freeze({ role: roleHints.get(index) ?? getMinifigPartRole(part), part })
    )
  )
