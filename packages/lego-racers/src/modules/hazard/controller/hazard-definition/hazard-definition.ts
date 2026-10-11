import { HazardDefinitionError } from '../../types/hazard-errors/hazard-errors.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import type {
  Hazard,
  Hazard33,
  Hazard34,
  Hazard36,
  Hazard3D,
  Hazard3E,
  Hazard40,
  Hazard43,
  Hazard48,
} from '../../types/hazard.types.ts'

// The hazard list is parsed into a union where the classes without data share one type, so a class that reads data
// asks for its own shape; the keyword is what tells them apart.
const getChecked = <Definition extends Hazard>(
  definition: Hazard,
  getIs: (candidate: Hazard) => candidate is Definition,
  keyword: number
): Definition => {
  if (!getIs(definition)) throw new HazardDefinitionError(definition.keyword, keyword)
  return definition
}

const getIs33 = (candidate: Hazard): candidate is Hazard33 =>
  candidate.keyword === HazardKeyword.HAZARD_33
const getIs34 = (candidate: Hazard): candidate is Hazard34 =>
  candidate.keyword === HazardKeyword.HAZARD_34
const getIs36 = (candidate: Hazard): candidate is Hazard36 =>
  candidate.keyword === HazardKeyword.HAZARD_36
const getIs3D = (candidate: Hazard): candidate is Hazard3D =>
  candidate.keyword === HazardKeyword.HAZARD_3D
const getIs3E = (candidate: Hazard): candidate is Hazard3E =>
  candidate.keyword === HazardKeyword.HAZARD_3E
const getIs40 = (candidate: Hazard): candidate is Hazard40 =>
  candidate.keyword === HazardKeyword.HAZARD_40
const getIs43 = (candidate: Hazard): candidate is Hazard43 =>
  candidate.keyword === HazardKeyword.HAZARD_43
const getIs48 = (candidate: Hazard): candidate is Hazard48 =>
  candidate.keyword === HazardKeyword.HAZARD_48

export const getHazard33 = (definition: Hazard): Hazard33 =>
  getChecked(definition, getIs33, HazardKeyword.HAZARD_33)
export const getHazard34 = (definition: Hazard): Hazard34 =>
  getChecked(definition, getIs34, HazardKeyword.HAZARD_34)
export const getHazard36 = (definition: Hazard): Hazard36 =>
  getChecked(definition, getIs36, HazardKeyword.HAZARD_36)
export const getHazard3D = (definition: Hazard): Hazard3D =>
  getChecked(definition, getIs3D, HazardKeyword.HAZARD_3D)
export const getHazard3E = (definition: Hazard): Hazard3E =>
  getChecked(definition, getIs3E, HazardKeyword.HAZARD_3E)
export const getHazard40 = (definition: Hazard): Hazard40 =>
  getChecked(definition, getIs40, HazardKeyword.HAZARD_40)
export const getHazard43 = (definition: Hazard): Hazard43 =>
  getChecked(definition, getIs43, HazardKeyword.HAZARD_43)
export const getHazard48 = (definition: Hazard): Hazard48 =>
  getChecked(definition, getIs48, HazardKeyword.HAZARD_48)
