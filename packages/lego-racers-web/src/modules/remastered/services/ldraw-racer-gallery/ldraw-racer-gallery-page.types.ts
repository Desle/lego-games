import type { Scene } from 'three'
import type { LDrawRacerPartDrawing } from '../ldraw-racer/ldraw-racer-drawing.types.ts'

export type GalleryView = 'front' | 'side' | 'top' | 'rear' | 'threeQuarter' | 'figureFront' | 'figureRear'

// Which skeleton and parts a driver is made for: the race's seated driver or the menus' standing figure.
export type GalleryFigure = 'race' | 'menu'

// A catalogue part of `BODYPART.PCB`, by the position of its byte among the five part bytes.
export type GalleryCatalogueSlot = 'hat' | 'face' | 'torso' | 'legs'

// A part of the figure a contact sheet looks at.
export type GalleryFocus = {
  readonly target: readonly [number, number, number]
  readonly distance: number
}

// A driver in a scene of his own, with the drawing that has to be disposed of.
export type GalleryDriver = {
  readonly scene: Scene
  readonly drawing: LDrawRacerPartDrawing
}
