import { CAR_STUD_UNITS } from '../ldraw-powerup/powerup-object-frame.ts'

// The size rule of LDraw particles, in one place. Every original quad of a mapped material is one piece (same count, place, life and
// fade as the original's simulation; nothing added). A piece keeps its own size (a car's stud per stud of its file, times the file's
// scale: powerup-object-frame.ts) and is never stretched over the quad: a quad narrower than the piece shrinks it to the quad, a wider
// one (a turbo's smoke is 8 studs across and grows to 12) keeps it at its own size at the quad's centre. Whatever a file's scale, a
// piece is never wider than PARTICLE_PIECE_MAXIMUM_WIDTH.
export const PARTICLE_PIECE_MAXIMUM_WIDTH = 3 * CAR_STUD_UNITS

// The race's units: a piece closer to the camera than this fades out (none closer than half of it), so smoke at the lens never
// fills the screen; the race camera sits about 10 units behind the car.
export const PARTICLE_NEAR_FADE_DISTANCE = 6

// How much of its own size (`pieceWidth`, race units) a piece is drawn at over a quad `width` by `height`; 0 draws nothing.
export const getParticlePieceScale = (
  width: number,
  height: number,
  pieceWidth: number
): number => {
  if (pieceWidth <= 0 || width <= 0 || height <= 0) return 0
  const drawnWidth = Math.min((width + height) / 2, pieceWidth, PARTICLE_PIECE_MAXIMUM_WIDTH)
  return drawnWidth / pieceWidth
}
