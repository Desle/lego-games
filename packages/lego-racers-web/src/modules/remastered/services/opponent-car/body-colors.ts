const BLACK = 0
const WHITE = 1
const BIEGE = 2
const LIGHT_GRAY = 3
const DARK_GRAY = 4
const RED = 5
const BROWN = 6
const YELLOW = 7
const GREEN = 8
const BLUE = 9

export const BRICK_COLOR_COUNT = 10
const GRAY_CHROMA_LIMIT = 0.2
const BLACK_LIMIT = 0.38
const DARK_GRAY_LIMIT = 0.46
const LIGHT_GRAY_LIMIT = 0.9
const BROWN_BRIGHTNESS_LIMIT = 0.6
const YELLOW_CHROMA_LIMIT = 0.45

// The brick colour (an index of L_COLORS.LEB) a colour of a champion's model stands for. The model's corners carry the brick
// colour times a shading (a side is darker than a top), so greys are told apart by how bright they are and the others by hue.
export const getBrickColorIndex = (red: number, green: number, blue: number): number => {
  const brightness = Math.max(red, green, blue) / 255
  const range = Math.max(red, green, blue) - Math.min(red, green, blue)
  const chroma = range / Math.max(1, Math.max(red, green, blue))
  if (chroma < GRAY_CHROMA_LIMIT) {
    if (brightness < BLACK_LIMIT) return BLACK
    if (brightness < DARK_GRAY_LIMIT) return DARK_GRAY
    return brightness < LIGHT_GRAY_LIMIT ? LIGHT_GRAY : WHITE
  }
  const maximum = Math.max(red, green, blue)
  let hue: number
  if (maximum === red) hue = (60 * (green - blue)) / range
  else if (maximum === green) hue = 120 + (60 * (blue - red)) / range
  else hue = 240 + (60 * (red - green)) / range
  hue = (hue + 360) % 360
  if (hue >= 80 && hue < 170) return GREEN
  if (hue >= 170 && hue < 270) return BLUE
  if (hue >= 30 && hue < 80) return chroma > YELLOW_CHROMA_LIMIT ? YELLOW : BIEGE
  if (hue >= 12 && hue < 30 && brightness < BROWN_BRIGHTNESS_LIMIT) return BROWN
  return RED
}
