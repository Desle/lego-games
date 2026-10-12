import type { Vector3 } from '../../simulation-math/index.ts'

// What a sprite's draw needs of the camera: its position, its forward vector and the "up" the engine passes as the
// frame's second row (the direction the picture's bottom edge points in the world).
export type WorldSpriteCamera = {
  readonly position: Vector3
  readonly forward: Vector3
  readonly up: Vector3
}
