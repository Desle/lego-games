import { LDrawDetail } from '../ldraw-library-loader/ldraw-library-loader.types.ts'

let isStudLogoShown = false

// Plain studs unless an app turns the LEGO logo on, once, before the first model is drawn.
export const setIsStudLogoShown = (isShown: boolean) => {
  isStudLogoShown = isShown
}

export const getIsStudLogoShown = (): boolean => isStudLogoShown

// The detail a model is built in: the one asked for, or the plain studs when the logos are off.
export const getModelDetail = (detail: LDrawDetail): LDrawDetail =>
  isStudLogoShown ? detail : LDrawDetail.LOW
