import type { BufferGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'

export type StandardMesh = Mesh<BufferGeometry, MeshStandardMaterial>

export type PlasticMesh = Mesh<BufferGeometry, MeshPhysicalMaterial>
