import type { FrontEndRectangle } from './front-end.types.ts'

// An image item: the style's image (MSB 0x32) at the item's rectangle.
export type ImageWidget = {
  readonly kind: 'image'
  readonly itemName: string
  readonly imageName: string
}

// A text item (MIB 0x39) showing a string in a font.
export type TextWidget = {
  readonly kind: 'text'
  readonly itemName: string
  readonly text: string
  readonly styleName: string
  readonly alignment: 'left' | 'center'
}

export type ButtonState = 'normal' | 'disabled' | 'focused'

// A button (MIB 0x46) of a style (MSB 0x3e): the state's image, then the label in the state's font and colour.
export type ButtonWidget = {
  readonly kind: 'button'
  readonly itemName: string
  readonly styleName: string
  readonly label: string
  readonly state: ButtonState
}

// A box (MIB 0x3a): eight border images around a filled rectangle.
export type FrameWidget = {
  readonly kind: 'frame'
  readonly itemName: string
  // The item whose rectangle the box takes (a chooser's box is declared once and used for each chooser).
  readonly rectangleItemName?: string
}

// A translucent fill over the whole screen (MIB 0x37).
export type FillWidget = {
  readonly kind: 'fill'
  readonly itemName: string
}

// A 3D object a screen shows (MIB 0x42, a world of MENUDATA) or a cinema (MIB 0x45).
export type ViewportWidget = {
  readonly kind: 'viewport'
  readonly itemName: string
}

// A rectangle the screen computed itself (a list row, a chooser).
export type PlacedImageWidget = {
  readonly kind: 'placed_image'
  readonly imageName: string
  readonly rectangle: FrontEndRectangle
}

// A string the screen places itself (the quit dialog), in a style's font and colour or in the given colour.
export type PlacedTextWidget = {
  readonly kind: 'placed_text'
  readonly text: string
  readonly styleName: string
  readonly rectangle: FrontEndRectangle
  readonly alignment: 'left' | 'center'
  readonly color: number | null
}

// A rectangle the screen places itself, filled and bordered like a box item (MSB 0x34 style `styleName`).
export type PlacedFrameWidget = {
  readonly kind: 'placed_frame'
  readonly rectangle: FrontEndRectangle
  readonly imageNames: readonly string[]
  readonly color: number
  readonly bottomColor: number
}

export type FrontEndWidget =
  | ImageWidget
  | TextWidget
  | ButtonWidget
  | FrameWidget
  | FillWidget
  | ViewportWidget
  | PlacedImageWidget
  | PlacedTextWidget
  | PlacedFrameWidget
