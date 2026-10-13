import { LDrawDetail } from '../ldraw-library-loader/ldraw-library-loader.types.ts'

export const STUD_LOGOS_PARAMETER = 'studlogos'
const HIDDEN_VALUE = '0'

let isStudLogoShown = true

// `studlogos=0` draws plain studs everywhere; by default a model near the camera shows the LEGO logo on its studs.
export const getIsStudLogoRequested = (search: string): boolean =>
  new URLSearchParams(search).get(STUD_LOGOS_PARAMETER) !== HIDDEN_VALUE

// Set once by the registration, before the first model is drawn.
export const setIsStudLogoShown = (isShown: boolean) => {
  isStudLogoShown = isShown
}

export const getIsStudLogoShown = (): boolean => isStudLogoShown

// The detail a model is built in: the one asked for, or the plain studs when the logos are off.
export const getModelDetail = (detail: LDrawDetail): LDrawDetail =>
  isStudLogoShown ? detail : LDrawDetail.LOW
