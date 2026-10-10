import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type { EmulatorCall } from '../../../../shared/emulator/emulator-client.types.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { BITMAP_BLOCK_BUFFER_LENGTH } from '../bitmap-block-reader/bitmap-block-reader.ts'
import { getIsWindowsBitmap, readBitmapHeader } from '../bitmap-header/bitmap-header.ts'
import { decompressLzss } from './lzss-decompressor.ts'

const LZSS_ADDRESS = 0x10032840
const BLOCK_HEADER_LENGTH = 4
const BYTES_PER_WORD = 4

type CompressedBlock = {
  readonly path: string
  readonly compressed: Uint8Array
}

const readUnsignedShort = (file: Uint8Array, position: number): number =>
  (file[position] ?? 0) | ((file[position + 1] ?? 0) << 8)

// GolDP.dll 0x10019fe0: a 4-bit row holds width * 4 + 4 bits, other depths width * depth.
const getRowLength = (width: number, bitsPerPixel: number): number =>
  (bitsPerPixel === 4 ? width * 4 + 4 : width * bitsPerPixel) >> 3

const getCompressedBlocks = (path: string, file: Uint8Array): readonly CompressedBlock[] => {
  if (getIsWindowsBitmap(file)) return []
  const header = readBitmapHeader(file)
  const blocks: CompressedBlock[] = []
  let remaining = getRowLength(header.width, header.bitsPerPixel) * header.height
  let position = header.pixelDataOffset
  while (remaining > 0 && position + BLOCK_HEADER_LENGTH <= file.byteLength) {
    const decompressedLength = readUnsignedShort(file, position)
    const compressedLength = readUnsignedShort(file, position + 2)
    const dataStart = position + BLOCK_HEADER_LENGTH
    const storedLength = Math.min(compressedLength, decompressedLength)
    if (compressedLength < decompressedLength) {
      blocks.push({ path, compressed: file.slice(dataStart, dataStart + compressedLength) })
    }
    remaining -= decompressedLength
    position = dataStart + storedLength
  }
  return blocks
}

const getAllCompressedBlocks = (): readonly CompressedBlock[] => {
  const archive = openJamArchive(readOriginalJam())
  return archive
    .getFilePaths()
    .filter((path) => path.toUpperCase().endsWith('.BMP'))
    .flatMap((path) => getCompressedBlocks(path, archive.readFile(path)))
}

// The engine copies the compressed block to the end of its 1500-byte buffer and decodes to the start.
const getBlockBuffer = (block: CompressedBlock): Uint8Array => {
  const buffer = new Uint8Array(BITMAP_BLOCK_BUFFER_LENGTH)
  buffer.set(block.compressed, BITMAP_BLOCK_BUFFER_LENGTH - block.compressed.byteLength)
  return buffer
}

const getWords = (bytes: Uint8Array): readonly number[] => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return Array.from({ length: bytes.byteLength / BYTES_PER_WORD }, (_, index) =>
    view.getUint32(index * BYTES_PER_WORD, true)
  )
}

const getBytes = (words: readonly number[]): Uint8Array => {
  const bytes = new Uint8Array(words.length * BYTES_PER_WORD)
  const view = new DataView(bytes.buffer)
  words.forEach((word, index) => view.setUint32(index * BYTES_PER_WORD, word, true))
  return bytes
}

const getEmulatorCall = (block: CompressedBlock): EmulatorCall => ({
  address: LZSS_ADDRESS,
  convention: 'cdecl',
  precision: 'single',
  arguments: [
    { buffer: 'block', offset: BITMAP_BLOCK_BUFFER_LENGTH - block.compressed.byteLength },
    { buffer: 'block' },
  ],
  buffers: [{ name: 'block', words: getWords(getBlockBuffer(block)), isRead: true }],
})

describe('LZSS decompressor 0x10032840 against the original', () => {
  it.skipIf(!getIsEmulatorAvailable() || !getIsOriginalJamPresent())(
    'decodes every compressed texture block of LEGO.JAM byte for byte like the original',
    async () => {
      // Arrange
      const blocks = getAllCompressedBlocks()
      const session = openEmulatorSession()

      // Act
      const results = await session
        .callBatch(blocks.map(getEmulatorCall))
        .finally(() => session.close())
      const mismatchedPaths = blocks.flatMap((block, index) => {
        const portBuffer = getBlockBuffer(block)
        const portLength = decompressLzss(
          portBuffer,
          BITMAP_BLOCK_BUFFER_LENGTH - block.compressed.byteLength
        )
        const original = results[index]
        const originalBuffer = getBytes(original?.buffers['block'] ?? [])
        const isSame =
          original?.eax === portLength && Buffer.compare(originalBuffer, portBuffer) === 0
        return isSame ? [] : [block.path]
      })

      // Assert
      expect(blocks.length).toBeGreaterThan(1000)
      expect(mismatchedPaths).toEqual([])
    },
    300_000
  )
})
