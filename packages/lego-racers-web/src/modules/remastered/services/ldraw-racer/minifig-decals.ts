import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'
import type { BufferGeometry } from 'three'
import type { TexturePixels } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { loadHighDefinitionPixels } from '../high-definition-texture/high-definition-texture.ts'
import type { PictureSource, UvRectangle } from './minifig-surfaces.types.ts'
import type { MinifigDecal } from './minifig-decals.types.ts'

const RAW_UNITS_PER_LDRAW_UNIT = 3.2
const HEAD_RADIUS = 13.15
const FACE_CENTRE_Y = 10.5
// The original's face card is 30 % of its head's width; a minifigure's printed face is about half of its head's, and a card that small
// does not read at race distance.
const FACE_SCALE = 1.5
const FACE_WIDTH_LIMITS = [8, 22] as const
const FACE_HEIGHT_LIMITS = [6, 14] as const
const ARC_SEGMENTS = 16
const TORSO_WIDTH = 38
const TORSO_HEIGHT = 32
const TORSO_FRONT_Z = -10.2
const DECAL_ROUGHNESS = 0.45
// A print stays readable on the side of the figure the studio's key light does not reach.
const DECAL_GLOW = 0.55
const POLYGON_OFFSET = -2
// The original colour-keys part of a picture (the skin around a face): those pixels have no alpha and show what is behind.
const ALPHA_TEST = 0.5

const clamp = (value: number, [minimum, maximum]: readonly [number, number]): number =>
  Math.min(Math.max(value, minimum), maximum)

// The part of a picture a UV rectangle shows, as a canvas (the figure builder's parts count v down the bitmap's rows: the face card's
// rectangle holds the eyes and the smile only that way).
const drawCrop = (pixels: TexturePixels, rectangle: UvRectangle): HTMLCanvasElement | null => {
  const left = Math.floor(rectangle.left * pixels.width)
  const right = Math.max(left + 1, Math.ceil(rectangle.right * pixels.width))
  const top = Math.floor(rectangle.bottom * pixels.height)
  const bottom = Math.max(top + 1, Math.ceil(rectangle.top * pixels.height))
  const source = document.createElement('canvas')
  source.width = pixels.width
  source.height = pixels.height
  const sourceContext = source.getContext('2d')
  const crop = document.createElement('canvas')
  crop.width = right - left
  crop.height = bottom - top
  const cropContext = crop.getContext('2d')
  if (sourceContext === null || cropContext === null) return null
  sourceContext.putImageData(
    new ImageData(new Uint8ClampedArray(pixels.colors), pixels.width, pixels.height),
    0,
    0
  )
  cropContext.drawImage(source, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return crop
}

const createDecalMaterial = (texture: CanvasTexture): MeshStandardMaterial =>
  new MeshStandardMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: DECAL_GLOW,
    roughness: DECAL_ROUGHNESS,
    metalness: 0,
    side: DoubleSide,
    transparent: true,
    alphaTest: ALPHA_TEST,
    polygonOffset: true,
    polygonOffsetFactor: POLYGON_OFFSET,
    polygonOffsetUnits: POLYGON_OFFSET,
  })

// A decal of a picture of the original: it shows the original's pixels at once and the texture pack's (when `search` turns the
// remastered textures on and the pack has the picture) as soon as they have loaded.
const createDecal = (
  picture: PictureSource,
  geometry: BufferGeometry,
  search: string
): MinifigDecal | null => {
  const original: TexturePixels = {
    colors: picture.bitmap.colors,
    width: picture.bitmap.width,
    height: picture.bitmap.height,
  }
  const canvas = drawCrop(original, picture.rectangle)
  if (canvas === null) return null
  const texture = new CanvasTexture(canvas)
  texture.magFilter = LinearFilter
  const mesh = new Mesh(geometry, createDecalMaterial(texture))
  const settled = loadHighDefinitionPixels(picture.bitmapPath, original, search).then((pixels) => {
    const sharper = pixels === null ? null : drawCrop(pixels, picture.rectangle)
    if (sharper === null) return
    texture.image = sharper
    texture.needsUpdate = true
  })
  return { mesh, settled: settled.catch(() => undefined) }
}

// The face: a patch of the head's front, as wide and as tall as the original's face surface (in the figure's units, within
// the limits of the head), showing the face's picture.
export const createFaceDecal = (picture: PictureSource, search: string): MinifigDecal | null => {
  const width = clamp((picture.width * FACE_SCALE) / RAW_UNITS_PER_LDRAW_UNIT, FACE_WIDTH_LIMITS)
  const height = clamp((picture.height * FACE_SCALE) / RAW_UNITS_PER_LDRAW_UNIT, FACE_HEIGHT_LIMITS)
  const arc = width / HEAD_RADIUS
  const geometry = new CylinderGeometry(
    HEAD_RADIUS,
    HEAD_RADIUS,
    height,
    ARC_SEGMENTS,
    1,
    true,
    Math.PI - arc / 2,
    arc
  )
  // LDraw's y points down: turning the patch half a turn about z keeps its front out and puts its picture's top up and its left on the viewer's left.
  geometry.rotateZ(Math.PI)
  geometry.translate(0, FACE_CENTRE_Y, 0)
  return createDecal(picture, geometry, search)
}

// The front of the torso: the picture over the torso's whole front.
export const createTorsoDecal = (picture: PictureSource, search: string): MinifigDecal | null => {
  const geometry = new PlaneGeometry(TORSO_WIDTH, TORSO_HEIGHT)
  geometry.rotateX(Math.PI)
  geometry.translate(0, TORSO_HEIGHT / 2, TORSO_FRONT_Z)
  return createDecal(picture, geometry, search)
}
