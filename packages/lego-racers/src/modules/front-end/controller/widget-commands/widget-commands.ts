import { getTextWidth, layoutText } from '../../../font-rendering/index.ts'
import type { FontDrawCommand } from '../../../font-rendering/index.ts'
import type { MenuEntry } from '../../../menu-file/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { FrontEndDrawCommand, FrontEndRectangle } from '../../types/front-end.types.ts'
import type {
  ButtonState,
  ButtonWidget,
  FontStyle,
  FrameFill,
  FrontEndWidget,
  ScreenContext,
} from '../../types/front-end-widget.types.ts'
import {
  findEntry,
  getAbsoluteRectangle,
  getProperty,
  getPropertyValues,
} from '../screen-layout/screen-layout.ts'

// The menus are drawn on a 640 × 480 surface.
export const MENU_SURFACE = Object.freeze({ width: 640, height: 480 })
// MSB 0x3e styles keep a gap of 14 pixels (their first 0x2b value) between a button's image and its text.
const BUTTON_IMAGE_GAP = 0
const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// The states of a button in the order of its style's six images, fonts and colours (hypothesis for the roles; the
// focused colour is the bright one the menus show).
const BUTTON_STATE_INDEX: Readonly<Record<ButtonState, number>> = Object.freeze({
  normal: 0,
  disabled: 1,
  focused: 5,
})

export const getCodeUnits = (text: string): readonly number[] =>
  Array.from(text, (letter) => letter.charCodeAt(0))

// 0xAARRGGBB from the four integers of a colour in a style (alpha, red, green, blue; 0x0046b210).
export const getColor = (values: readonly (number | string)[], index: number): number => {
  const [alpha, red, green, blue] = [0, 1, 2, 3].map((offset) =>
    Number(values[index * 4 + offset] ?? 0)
  )
  return (((alpha ?? 0) << 24) | ((red ?? 0) << 16) | ((green ?? 0) << 8) | (blue ?? 0)) >>> 0
}

export const getStyleEntry = (context: ScreenContext, styleName: string): MenuEntry | null =>
  (context.files.styles === null ? null : findEntry(context.files.styles, styleName)) ??
  findEntry(context.resources.globalStyles, styleName)

const getStringValue = (value: number | string | undefined): string =>
  typeof value === 'string' ? value : ''

// What a font style names: the font (0x29) and the colour (0x2a) of its text.
const getFontStyle = (context: ScreenContext, styleName: string): FontStyle => {
  const entry = getStyleEntry(context, styleName)
  const fontName = getStringValue(entry === null ? undefined : getPropertyValues(entry, 0x29)?.[0])
  const colors = entry === null ? null : getPropertyValues(entry, 0x2a)
  return { fontName, color: colors === null ? 0xffffffff : getColor(colors, 0) }
}

const getTextGlyphs = (
  context: ScreenContext,
  fontName: string,
  text: string,
  rectangle: FrontEndRectangle,
  alignment: 'left' | 'center'
): readonly FontDrawCommand[] => {
  const font = context.resources.getFont(fontName)
  if (font === null) return []
  return layoutText({
    font,
    text: getCodeUnits(text),
    surface: MENU_SURFACE,
    x: rectangle.left,
    y: rectangle.top,
    maximumWidth: Math.max(1, rectangle.right - rectangle.left),
    lineGap: 0,
    scale: { x: 1, y: 1 },
    clip: null,
    alignment,
    arithmetic,
  })
}

const getTextSize = (context: ScreenContext, fontName: string, text: string) => {
  const font = context.resources.getFont(fontName)
  if (font === null) return { width: 0, height: 0 }
  const lines = text.split('\n')
  const widths = lines.map((line) => getTextWidth(font, getCodeUnits(line)).width)
  return { width: Math.max(0, ...widths), height: font.lineHeight * lines.length }
}

const getImageCommand = (
  context: ScreenContext,
  imageName: string,
  rectangle: FrontEndRectangle
): readonly FrontEndDrawCommand[] => {
  const image = context.resources.getImage(imageName)
  if (image === null) return []
  const commands: FrontEndDrawCommand[] = []
  // 0x0046f330: an item larger than its image repeats the image across the rectangle.
  for (let top = rectangle.top; top < rectangle.bottom; top += image.height) {
    for (let left = rectangle.left; left < rectangle.right; left += image.width) {
      commands.push({
        kind: 'image',
        imageName,
        left,
        top,
        width: Math.min(image.width, rectangle.right - left),
        height: Math.min(image.height, rectangle.bottom - top),
      })
    }
  }
  return commands
}

const getImageRectangle = (context: ScreenContext, entry: MenuEntry, imageName: string) => {
  const image = context.resources.getImage(imageName)
  return getAbsoluteRectangle(context.files.description, entry, {
    width: image?.width ?? 0,
    height: image?.height ?? 0,
  })
}

// The image an image style (MSB 0x32) names.
const getStyleImageName = (context: ScreenContext, styleName: string): string =>
  getStringValue(getPropertyValues(getStyleEntry(context, styleName) ?? EMPTY_ENTRY, 0x28)?.[0])

const EMPTY_ENTRY: MenuEntry = Object.freeze({ keyword: 0, name: '', properties: [] })

const getButtonCommands = (
  context: ScreenContext,
  entry: MenuEntry,
  widget: ButtonWidget
): readonly FrontEndDrawCommand[] => {
  const style = getStyleEntry(context, widget.styleName)
  if (style === null) return []
  const index = BUTTON_STATE_INDEX[widget.state]
  const imageName = getStringValue(getPropertyValues(style, 0x28)?.[index])
  const fontName = getStringValue(getPropertyValues(style, 0x29)?.[index])
  const colors = getPropertyValues(style, 0x2a) ?? []
  const color = getColor(colors, 7 + index)
  const image = context.resources.getImage(imageName)
  const imageWidth = image?.width ?? 0
  const imageHeight = image?.height ?? 0
  const textSize = getTextSize(context, fontName, widget.label)
  const textLeftOffset = imageWidth === 0 ? 0 : imageWidth + BUTTON_IMAGE_GAP
  const rectangle = getAbsoluteRectangle(context.files.description, entry, {
    width: textLeftOffset + textSize.width,
    height: Math.max(imageHeight, textSize.height),
  })
  const textTop =
    rectangle.top +
    Math.max(0, Math.floor((rectangle.bottom - rectangle.top - textSize.height) / 2))
  const commands: FrontEndDrawCommand[] = [
    ...(image === null
      ? []
      : getImageCommand(context, imageName, {
          left: rectangle.left,
          top: rectangle.top,
          right: rectangle.left + imageWidth,
          bottom: rectangle.top + imageHeight,
        })),
  ]
  const glyphs = getTextGlyphs(
    context,
    fontName,
    widget.label,
    {
      left: rectangle.left + textLeftOffset,
      top: textTop,
      right: rectangle.right,
      bottom: rectangle.bottom,
    },
    'left'
  )
  if (glyphs.length > 0) commands.push({ kind: 'text', fontName, glyphs, color })
  return commands
}

const getFrameDrawing = (
  context: ScreenContext,
  rectangle: FrontEndRectangle,
  names: readonly string[],
  fill: FrameFill | null
): readonly FrontEndDrawCommand[] => {
  const commands: FrontEndDrawCommand[] = []
  if (fill !== null) commands.push({ kind: 'fill', rectangle, ...fill })
  const [
    cornerTopLeft,
    edgeTop,
    cornerTopRight,
    edgeRight,
    cornerBottomRight,
    edgeBottom,
    cornerBottomLeft,
    edgeLeft,
  ] = names
  const step = context.resources.getImage(cornerTopLeft ?? '')?.width ?? 0
  if (step === 0) return commands
  const place = (
    name: string | undefined,
    left: number,
    top: number,
    right: number,
    bottom: number
  ) => commands.push(...getImageCommand(context, name ?? '', { left, top, right, bottom }))
  place(edgeTop, rectangle.left + step, rectangle.top, rectangle.right - step, rectangle.top + step)
  place(
    edgeBottom,
    rectangle.left + step,
    rectangle.bottom - step,
    rectangle.right - step,
    rectangle.bottom
  )
  place(
    edgeLeft,
    rectangle.left,
    rectangle.top + step,
    rectangle.left + step,
    rectangle.bottom - step
  )
  place(
    edgeRight,
    rectangle.right - step,
    rectangle.top + step,
    rectangle.right,
    rectangle.bottom - step
  )
  place(cornerTopLeft, rectangle.left, rectangle.top, rectangle.left + step, rectangle.top + step)
  place(
    cornerTopRight,
    rectangle.right - step,
    rectangle.top,
    rectangle.right,
    rectangle.top + step
  )
  place(
    cornerBottomRight,
    rectangle.right - step,
    rectangle.bottom - step,
    rectangle.right,
    rectangle.bottom
  )
  place(
    cornerBottomLeft,
    rectangle.left,
    rectangle.bottom - step,
    rectangle.left + step,
    rectangle.bottom
  )
  return commands
}

// A box item names its border images and colours itself (MIB 0x28, 0x2a) or takes them from the box style of the same
// name (MSB 0x34, `brickbox` and `roundbox`).
const getFrameCommands = (
  context: ScreenContext,
  entry: MenuEntry,
  rectangle: FrontEndRectangle
): readonly FrontEndDrawCommand[] => {
  const source =
    getPropertyValues(entry, 0x28) === null ? (getStyleEntry(context, entry.name) ?? entry) : entry
  const names = (getPropertyValues(source, 0x28) ?? []).map(getStringValue)
  const colors = getPropertyValues(source, 0x2a) ?? []
  const fill =
    colors.length >= 8 ? { color: getColor(colors, 0), bottomColor: getColor(colors, 1) } : null
  return getFrameDrawing(context, rectangle, names, fill)
}

// A widget's draw commands, in the order the original draws them: the item's own images and text.
export const getWidgetCommands = (
  context: ScreenContext,
  widget: FrontEndWidget
): readonly FrontEndDrawCommand[] => {
  if (widget.kind === 'placed_image') {
    return getImageCommand(context, widget.imageName, widget.rectangle)
  }
  if (widget.kind === 'placed_frame') {
    return getFrameDrawing(context, widget.rectangle, widget.imageNames, {
      color: widget.color,
      bottomColor: widget.bottomColor,
    })
  }
  if (widget.kind === 'placed_text') {
    const style = getFontStyle(context, widget.styleName)
    const glyphs = getTextGlyphs(
      context,
      style.fontName,
      widget.text,
      widget.rectangle,
      widget.alignment
    )
    const color = widget.color ?? style.color
    return glyphs.length === 0 ? [] : [{ kind: 'text', fontName: style.fontName, glyphs, color }]
  }
  const entry = findEntry(context.files.description, widget.itemName)
  if (entry === null) return []
  switch (widget.kind) {
    case 'image':
      return getImageCommand(
        context,
        widget.imageName,
        getImageRectangle(context, entry, widget.imageName)
      )
    case 'text': {
      const { fontName, color } = getFontStyle(context, widget.styleName)
      const size = getTextSize(context, fontName, widget.text)
      const rectangle = getAbsoluteRectangle(context.files.description, entry, size)
      const glyphs = getTextGlyphs(context, fontName, widget.text, rectangle, widget.alignment)
      return glyphs.length === 0 ? [] : [{ kind: 'text', fontName, glyphs, color }]
    }
    case 'button':
      return getButtonCommands(context, entry, widget)
    case 'frame': {
      const rectangleEntry =
        widget.rectangleItemName === undefined
          ? entry
          : (findEntry(context.files.description, widget.rectangleItemName) ?? entry)
      return getFrameCommands(
        context,
        entry,
        getAbsoluteRectangle(context.files.description, rectangleEntry, { width: 0, height: 0 })
      )
    }
    case 'fill': {
      const color = getColor(getPropertyValues(entry, 0x2a) ?? [], 0)
      const rectangle = { left: 0, top: 0, right: MENU_SURFACE.width, bottom: MENU_SURFACE.height }
      return [{ kind: 'fill', rectangle, color, bottomColor: color }]
    }
    case 'viewport': {
      const model = getStringValue(getPropertyValues(entry, 0x2d)?.[0])
      const camera = (getPropertyValues(entry, 0x2e) ?? []).map(Number)
      const rectangle = getAbsoluteRectangle(context.files.description, entry, {
        width: 0,
        height: 0,
      })
      // A viewport names the box item it sits in (0x3a): the box is drawn around its rectangle.
      const frameName = getStringValue(getPropertyValues(entry, 0x3a)?.[0])
      const frameEntry = frameName === '' ? null : findEntry(context.files.description, frameName)
      const frame = frameEntry === null ? [] : getFrameCommands(context, frameEntry, rectangle)
      return [
        ...frame,
        {
          kind: 'viewport',
          modelName: model,
          rectangle,
          camera,
          builder: widget.builder ?? null,
          driver: widget.driver ?? null,
          showcase: widget.showcase ?? null,
          cinema: widget.cinema ?? null,
        },
      ]
    }
  }
}

export { getProperty, getStyleImageName }
