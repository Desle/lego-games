// GolDP.dll 0x1001e190: "Incomplete font image: missing characters" when a glyph column run is empty.
export class IncompleteFontImageError extends Error {
  readonly fontName: string

  constructor(fontName: string) {
    super(`Incomplete font image ${fontName}: missing characters`)
    this.name = 'IncompleteFontImageError'
    this.fontName = fontName
  }
}

export class MissingFontCharactersError extends Error {
  readonly fontName: string

  constructor(fontName: string) {
    super(`Font ${fontName} has no character list`)
    this.name = 'MissingFontCharactersError'
    this.fontName = fontName
  }
}
