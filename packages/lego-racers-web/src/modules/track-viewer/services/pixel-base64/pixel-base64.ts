const BASE64_CHUNK_BYTES = 0x8000

// The pixels of a frame as base64, the form the headless browser hands them to the test in.
export const getPixelsBase64 = (bytes: Uint8ClampedArray): string => {
  const chunks: string[] = []
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_BYTES) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK_BYTES)))
  }
  return btoa(chunks.join(''))
}
