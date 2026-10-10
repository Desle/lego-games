import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { decodeSoundBank } from './decode-sound-bank.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const encode = (text: string): Uint8Array =>
  Uint8Array.from({ length: text.length }, (_, index) => text.charCodeAt(index))

describe('decodeSoundBank', () => {
  it('joins the directory line with every lowercased sound name', () => {
    // Arrange
    const bytes = encode('Sounds\\\r\n2\r\nActivate.PCM\r\nok.pcm\r\n')

    // Act
    const soundBank = decodeSoundBank(bytes)

    // Assert
    expect(soundBank).toEqual({
      directory: 'Sounds\\',
      declaredSoundCount: 2,
      soundPaths: ['Sounds\\activate.pcm', 'Sounds\\ok.pcm'],
    })
  })

  it('reads a last name without a line end and ignores lines beyond the count', () => {
    // Arrange
    const withoutLineEnd = encode('\r\n1\r\nRockWrks.pcm')
    const withExtraLines = encode('\r\n1\r\nfoot.pcm\r\n\r\nextra.pcm\r\n')

    // Act
    const lastNameBank = decodeSoundBank(withoutLineEnd)
    const extraLinesBank = decodeSoundBank(withExtraLines)

    // Assert
    expect(lastNameBank.soundPaths).toEqual(['rockwrks.pcm'])
    expect(extraLinesBank.soundPaths).toEqual(['foot.pcm'])
  })

  it('leaves the path empty for every declared sound past the end of the file', () => {
    // Arrange
    const bytes = encode('\r\n3\r\nfoot.pcm\r\n')

    // Act
    const soundBank = decodeSoundBank(bytes)

    // Assert
    expect(soundBank.soundPaths).toEqual(['foot.pcm', '', ''])
  })

  it('parses the count like atoi from a three-character buffer', () => {
    // Arrange
    const withSpace = encode('\r\n 1x\r\nfoot.pcm\r\n')
    const negative = encode('\r\n-1\r\nfoot.pcm\r\n')
    const tooLong = encode('\r\n1000\r\na.pcm\r\nb.pcm\r\n')

    // Act
    const counts = [withSpace, negative, tooLong].map(
      (bytes) => decodeSoundBank(bytes).declaredSoundCount
    )

    // Assert
    expect(counts).toEqual([1, -1, 100])
  })

  it('truncates a joined path to 259 characters', () => {
    // Arrange
    const bytes = encode(`${'d'.repeat(200)}\r\n1\r\n${'n'.repeat(100)}\r\n`)

    // Act
    const soundBank = decodeSoundBank(bytes)

    // Assert
    expect(soundBank.soundPaths[0]).toHaveLength(259)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'decodes every .SBK in the original LEGO.JAM to sounds that exist beside it',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const filePaths = archive.getFilePaths()
      const existingPaths = new Set(filePaths)
      const bankPaths = filePaths.filter((path) => path.endsWith('.SBK'))

      // Act
      const referencedPaths = bankPaths.flatMap((bankPath) => {
        const soundBank = decodeSoundBank(archive.readFile(bankPath))
        expect(soundBank.soundPaths).toHaveLength(soundBank.declaredSoundCount)
        const bankDirectory = bankPath.slice(0, bankPath.lastIndexOf('\\') + 1)
        return soundBank.soundPaths.map((soundPath) => (bankDirectory + soundPath).toUpperCase())
      })

      // Assert
      expect(bankPaths).toHaveLength(63)
      expect(referencedPaths.filter((path) => !existingPaths.has(path))).toEqual([])
      expect(new Set(referencedPaths)).toEqual(
        new Set(filePaths.filter((path) => path.endsWith('.PCM')))
      )
    }
  )
})
