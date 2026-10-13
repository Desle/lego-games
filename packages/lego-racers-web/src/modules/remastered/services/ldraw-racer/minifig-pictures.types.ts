import type { SceneBitmap } from '@lego-games/lego-racers/scene'

// A rectangle of a picture in the UV of the figure builder's parts (u across, v down the bitmap's rows).
export type UvRectangle = {
  readonly left: number
  readonly right: number
  readonly bottom: number
  readonly top: number
}

// A picture the original puts on a part (the face, the front of the torso) and the rectangle of it the part shows.
export type PictureSource = {
  readonly bitmapPath: string
  readonly bitmap: SceneBitmap
  readonly rectangle: UvRectangle
  // The size of the part's surface in raw model units: width across the figure, height up it.
  readonly width: number
  readonly height: number
}

// The pictures the figure builder's model of a driver shows on his face and the front of his torso.
export type MinifigPictures = {
  readonly face: PictureSource | null
  readonly torso: PictureSource | null
}

// A triangle of the model's mesh with the bone that carries it and the x of its normal (positive faces forward).
export type SurfaceTriangle = {
  readonly boneIndex: number
  readonly vertices: readonly number[]
  readonly normalX: number
}
