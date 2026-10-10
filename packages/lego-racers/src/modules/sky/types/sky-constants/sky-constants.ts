// Arguments `Sky_Load` (LEGORacers.exe 0x0041c550, 0x0041ca69..0x0041cace) gives the sphere builder 0x004907f0.
export const SKY_DOME_RADIUS = 100
export const SKY_DOME_SEGMENT_COUNT = 11

// 0x004b02f8 (2π) and 0x004b4764 (-π/2) as float32.
export const FULL_TURN = Math.fround(2 * Math.PI)
export const NEGATIVE_QUARTER_TURN = -Math.fround(Math.PI / 2)
// The literal 0x3fc90fdb the builder stores for the last ring of a hemisphere.
export const QUARTER_TURN = Math.fround(Math.PI / 2)

// 0x004afde0 and 0x004afddc: the offsets 0x0041d040 subtracts from and adds to the camera height.
export const DOME_HEIGHT_REFERENCE = 10
export const BACKDROP_HEIGHT_REFERENCE = 40
