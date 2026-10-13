import { LDrawDetail } from '../ldraw-library-loader/ldraw-library-loader.types.ts'

export const STUD_LOGOS_PARAMETER = 'studlogos'
const SHOWN_VALUE = '1'

let isStudLogoShown = false

// Plain studs by default (the user's choice); `studlogos=1` shows the LEGO logo on the studs of a model near the camera.
export const getIsStudLogoRequested = (search: string): boolean =>
  new URLSearchParams(search).get(STUD_LOGOS_PARAMETER) === SHOWN_VALUE

// Set once by the registration, before the first model is drawn.
export const setIsStudLogoShown = (isShown: boolean) => {
  isStudLogoShown = isShown
}

export const getIsStudLogoShown = (): boolean => isStudLogoShown

// The detail a model is built in: the one asked for, or the plain studs when the logos are off.
export const getModelDetail = (detail: LDrawDetail): LDrawDetail =>
  isStudLogoShown ? detail : LDrawDetail.LOW
