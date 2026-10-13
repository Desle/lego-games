import { BufferGeometry, Material, Mesh } from 'three'
import type { Object3D } from 'three'

export const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

export const getIsMaterial = (value: unknown): value is Material => value instanceof Material

export const getIsGeometry = (value: unknown): value is BufferGeometry =>
  value instanceof BufferGeometry
