import { parseBuilderDocument, serializeBuilderDocument } from '@lego-games/ldraw/building'
import { getModelFileScale, removeScaleMeta, setScaleMeta } from './ldraw-scale-meta.ts'

const FILE = [
  '0 Racers power-up object DMISSILE',
  '0 Name: DMISSILE.ldr',
  '0 !LDRAW_ORG Unofficial_Model',
  '0 !RACERS SCALE 1.25',
  '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
  '1 15 0 -24 0 1 0 0 0 1 0 0 0 1 3003.dat',
].join('\n')

describe('the scale meta line', () => {
  it("reads a file's scale, and none from a file without a valid line", () => {
    // Arrange
    const texts = [FILE, '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat', '0 !RACERS SCALE -2']

    // Act
    const scales = texts.map(getModelFileScale)

    // Assert
    expect(scales).toEqual([1.25, null, null])
  })

  it('survives the builder document round trip once, whichever part it was kept with', () => {
    // Arrange
    const document = parseBuilderDocument(FILE)

    // Act
    const saved = serializeBuilderDocument(setScaleMeta(removeScaleMeta(document), 0.8))
    const reread = parseBuilderDocument(saved)
    const savedAgain = serializeBuilderDocument(
      setScaleMeta(removeScaleMeta(reread), getModelFileScale(saved))
    )

    // Assert
    expect([
      getModelFileScale(saved),
      saved.match(/!RACERS SCALE/g)?.length,
      reread.parts.length,
      savedAgain === saved,
    ]).toEqual([0.8, 1, 2, true])
  })

  it('keeps the line when the part it was read with is deleted, and drops it when fitted', () => {
    // Arrange
    const document = removeScaleMeta(parseBuilderDocument(FILE))
    const withoutFirstPart = { ...document, parts: document.parts.slice(1) }

    // Act
    const kept = serializeBuilderDocument(setScaleMeta(withoutFirstPart, 2))
    const fitted = serializeBuilderDocument(setScaleMeta(document, null))

    // Assert
    expect([getModelFileScale(kept), getModelFileScale(fitted)]).toEqual([2, null])
  })
})
