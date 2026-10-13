import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import { createPartStudLists, parsePartLine, rotateVector } from '@lego-games/ldraw/building'
import { readDevelopmentLibraryFile } from '../ldraw-library/ldraw-library-reader.ts'
import type { PartStud, PartStudLists } from '@lego-games/ldraw/building'
import type { BuilderPartLine } from '../ldraw-builder/ldraw-builder.types.ts'
import { getChassisDeck, getStudBases } from './chassis-deck.ts'
import type { ChassisDeck, StudBase } from './chassis-deck.types.ts'

const libraryStudLists = createPartStudLists(readDevelopmentLibraryFile)

const getPlacedStud = (line: BuilderPartLine, stud: PartStud): PartStud => {
  const turned = rotateVector(line.rotation, stud.position)
  return Object.freeze({
    position: [
      turned[0] + line.position[0],
      turned[1] + line.position[1],
      turned[2] + line.position[2],
    ] as const,
    direction: rotateVector(line.rotation, stud.direction),
  })
}

// The bases of a recipe's upright studs, from the stud primitives of the library parts it places (recipe axes).
export const loadRecipeStudBases = async (
  recipeText: string,
  studLists: PartStudLists = libraryStudLists
): Promise<readonly StudBase[]> => {
  const lines = recipeText
    .split(/\r?\n/)
    .map(parsePartLine)
    .filter((line): line is BuilderPartLine => line !== null)
  const studs = await Promise.all(
    lines.map(async (line) =>
      (await studLists.load(line.partName)).map((stud) => getPlacedStud(line, stud))
    )
  )
  return getStudBases(studs.flat())
}

// The deck the design's chassis recipe gives its bricks (recipes are keyed by the chassis part's name in lower case); null when the
// design has no chassis with a recipe, or the recipe has no upright stud the library knows.
export const loadDesignChassisDeck = async (
  design: CarDesign,
  chassisModels: ReadonlyMap<string, string>,
  studLists: PartStudLists = libraryStudLists
): Promise<ChassisDeck | null> => {
  for (const brick of design.bricks) {
    const recipeText = chassisModels.get(brick.piece.name.toLowerCase())
    if (recipeText === undefined) continue
    return getChassisDeck(brick.piece.footprint, await loadRecipeStudBases(recipeText, studLists))
  }
  return null
}
