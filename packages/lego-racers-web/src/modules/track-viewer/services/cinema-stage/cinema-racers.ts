import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { parseModel } from '@lego-games/lego-racers/model'
import type { ModelScene, Scene, SceneInstance } from '@lego-games/lego-racers/scene'
import {
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Group, Matrix4 } from 'three'
import type { Object3D, Scene as ThreeScene } from 'three'
import { loadChampionWheels } from '../racer-drawing/chassis-wheels.ts'
import { followCarDrawing, followDriverDrawing } from '../racer-drawing/racer-drawing.ts'
import type { FollowedDrawing } from '../racer-drawing/racer-drawing.types.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { CinemaCar, CinemaRacer, CinemaRacers, QuarterTurn } from './cinema-racers.types.ts'

const QUARTER_TURN_LEFT: QuarterTurn = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
]
const QUARTER_TURN_RIGHT: QuarterTurn = [
  [0, 1, 0],
  [-1, 0, 0],
  [0, 0, 1],
]
const NO_TURN: QuarterTurn = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]
const HALF_TURN: QuarterTurn = [
  [-1, 0, 0],
  [0, -1, 0],
  [0, 0, 1],
]
// `KK_CAR`'s body bone lies on its side: the race's forward is the bone's z, its left the bone's x and its up the bone's y.
const ON_ITS_SIDE: QuarterTurn = [
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 0],
]

// The cinema worlds' own cars of the champions, by the mesh file they draw. Each frame was measured by fitting the race's body model
// (and, for a cinema model that has its wheels, the chassis's wheels at rest) onto the cinema's mesh: the mean distance of the race's
// vertices to the nearest of the cinema's is 0.002 studs for `CR_CAR` (the race car at 0.87), 0 for `JT_CAR`, 0.04 to 0.15 for
// `VV_CAR`, `KK_CAR`, `RRCAR` and `GM_CAR`. `BB_CAR` and `BVB_CAR` are models of their own (0.5 and 0.8 studs): their frame is the
// best fit at the race's size. The cinemas of the first five circuits draw the wheels as instances of their own.
export const CINEMA_CARS: ReadonlyMap<string, CinemaCar> = new Map([
  [
    'MENUDATA\\CIRCUIT1\\CR_CAR.GDB',
    {
      carCode: 'CRCM',
      wheelInstanceNames: ['crft'],
      turn: QUARTER_TURN_RIGHT,
      scale: 0.87,
      offset: [-1.304, 0.432, -1.602],
    },
  ],
  [
    'MENUDATA\\CIRCUIT2\\KK_CAR.GDB',
    {
      carCode: 'KKCM',
      wheelInstanceNames: ['bb_fw', 'bb_rw'],
      turn: ON_ITS_SIDE,
      scale: 1,
      offset: [0.006, -4.937, -0.922],
    },
  ],
  [
    'MENUDATA\\CIRCUIT3\\BB_CAR.GDB',
    {
      carCode: 'BBCM',
      wheelInstanceNames: ['bb_fw', 'bb_rw'],
      turn: QUARTER_TURN_LEFT,
      scale: 1,
      offset: [-0.242, 0.628, -3.152],
    },
  ],
  [
    'MENUDATA\\CIRCUIT4\\JT_CAR.GDB',
    {
      carCode: 'JTCM',
      wheelInstanceNames: ['bvbft'],
      turn: NO_TURN,
      scale: 1,
      offset: [0.502, 0, -0.517],
    },
  ],
  [
    'MENUDATA\\CIRCUIT5\\BVB_CAR.GDB',
    {
      carCode: 'BVBCM',
      wheelInstanceNames: ['bvbbt1'],
      turn: QUARTER_TURN_RIGHT,
      scale: 1,
      offset: [-0.218, 0.796, -2.679],
    },
  ],
  [
    'MENUDATA\\CIRCUIT6\\GM_CAR.GDB',
    {
      carCode: 'GMCM',
      wheelInstanceNames: [],
      turn: NO_TURN,
      scale: 1,
      offset: [0.843, 0.022, -3.088],
    },
  ],
  [
    'MENUDATA\\WINVVCAR\\VV_CAR.GDB',
    {
      carCode: 'VVCM',
      wheelInstanceNames: [],
      turn: HALF_TURN,
      scale: 1,
      offset: [-0.131, -0.005, -2.553],
    },
  ],
  [
    'MENUDATA\\WINRRCAR\\RRCAR.GDB',
    {
      carCode: 'RRCM',
      wheelInstanceNames: [],
      turn: QUARTER_TURN_LEFT,
      scale: 1,
      offset: [0.036, -1.518, 0.153],
    },
  ],
])

const BODY_BONE_INDEX = 0

// Where the race car's frame lies in the frame of the cinema's mesh.
export const getCinemaCarFrame = (car: CinemaCar): Matrix4 => {
  const [first, second, third] = car.turn
  const { scale } = car
  const [x, y, z] = car.offset
  return new Matrix4().set(
    scale * first[0],
    scale * first[1],
    scale * first[2],
    x,
    scale * second[0],
    scale * second[1],
    scale * second[2],
    y,
    scale * third[0],
    scale * third[1],
    scale * third[2],
    z,
    0,
    0,
    0,
    1
  )
}

// A minifigure's skeleton as the menus' and the cinemas' figures have it: a chest and the two thighs (bones named per file:
// `chestbrr`, `ches1644`, `l_th2269`, `l_thghbr`).
export const getIsFigureSkeleton = (boneNames: readonly string[]): boolean =>
  boneNames.some((name) => name.startsWith('ches')) &&
  boneNames.some((name) => name.startsWith('l_th')) &&
  boneNames.some((name) => name.startsWith('r_th'))

const getFileStem = (path: string): string =>
  (path.split('\\').at(-1) ?? '').replace(/\.[^.]*$/, '').toUpperCase()

const getInstanceGroup = (
  worldObject: SceneObject,
  instance: SceneInstance,
  meshPath: string
): Object3D | null =>
  worldObject.group.children.find(
    (child) => child.name === instance.name && child.userData['meshPath'] === meshPath
  ) ?? null

// Hides or shows again the meshes the original draws for the instances of these names.
const setOriginalHidden = (
  worldObject: SceneObject,
  instanceNames: readonly string[],
  isHidden: boolean
): void => {
  for (const child of worldObject.group.children) {
    if (!instanceNames.includes(child.name)) continue
    child.traverse((object) => {
      if ('isMesh' in object && object.isMesh === true)
        Object.assign(object, { visible: !isHidden })
    })
  }
}

// The bone that carries a skeleton instance's body, for a state (the rest pose when none).
const getBodyBoneMatrix = (
  scene: Scene,
  instance: SceneInstance,
  state: SkeletonAnimationState | null
): Matrix4 => {
  const level = instance.levels[0]
  const skeleton = scene.skeletons[level?.skeletonIndex ?? -1]?.skeleton
  const animation = scene.animations[level?.animationIndex ?? -1]?.animation
  if (skeleton === undefined || animation === undefined) return new Matrix4()
  const restPose = getRestPose(skeleton)
  const pose = state === null ? restPose : getSkeletonPose(restPose, animation, state)
  return new Matrix4().fromArray(getBoneMatrices(skeleton, pose), BODY_BONE_INDEX * 16)
}

const getModelScale = (archive: JamArchive, meshPath: string): number => {
  try {
    return parseModel(archive.readFile(meshPath)).scale
  } catch {
    return 1
  }
}

const findCinemaRacers = (
  archive: JamArchive,
  scene: Scene,
  worldObject: SceneObject
): readonly CinemaRacer[] =>
  scene.instances.flatMap((instance): readonly CinemaRacer[] => {
    const level = instance.levels[0]
    const mesh = scene.meshes[level?.meshIndex ?? -1]
    const group = mesh === undefined ? null : getInstanceGroup(worldObject, instance, mesh.path)
    if (mesh === undefined || group === null) return []
    const car = CINEMA_CARS.get(mesh.path.toUpperCase())
    if (car !== undefined) {
      const scale = getModelScale(archive, mesh.path)
      const scaling = new Matrix4().makeScale(scale, scale, scale)
      const carFrame = getCinemaCarFrame(car)
      const isSkeleton = level?.skeletonIndex !== null
      return [
        {
          instance,
          group,
          create: (host) => {
            const wheels = loadChampionWheels(archive, car.carCode)
            if (wheels === null) return null
            const names = [instance.name, ...car.wheelInstanceNames]
            return followCarDrawing(
              { archive, carCode: car.carCode, design: null, wheels },
              host,
              (isHidden) => setOriginalHidden(worldObject, names, isHidden)
            )
          },
          getFrame: (state) =>
            (isSkeleton
              ? scaling.clone().multiply(getBodyBoneMatrix(scene, instance, state))
              : scaling.clone()
            ).multiply(carFrame),
        },
      ]
    }
    const skeleton = scene.skeletons[level?.skeletonIndex ?? -1]?.skeleton
    if (
      skeleton === undefined ||
      !getIsFigureSkeleton(skeleton.bones.map((bone) => bone.name.toLowerCase()))
    ) {
      return []
    }
    const model: ModelScene = Object.freeze({
      scene: Object.freeze({ ...scene, instances: Object.freeze([instance]) }),
      meshScales: Object.freeze([getModelScale(archive, mesh.path)]),
    })
    return [
      {
        instance,
        group,
        create: (host) =>
          followDriverDrawing(
            { archive, driver: { model, modelName: getFileStem(mesh.path), partBytes: null } },
            host,
            (isHidden) => setOriginalHidden(worldObject, [instance.name], isHidden)
          ),
        getFrame: () => new Matrix4(),
      },
    ]
  })

// The champions' cars and the figures a cinema world draws, each drawn by a viewer extension when it has a drawing for it (through
// the same hooks as the race and the menus), the original's meshes hidden then. A drawing is asked for when its instance first
// shows, follows the instance's frame (the model's scale applied, as GolDP.dll carries a model's points: through its bones, times its
// scale, by the instance's frame) and its skeleton's clip, and is shown while the instance is.
export const createCinemaRacers = (
  archive: JamArchive,
  three: ThreeScene,
  scene: Scene,
  worldObject: SceneObject,
  getSkeletonState: (instanceName: string) => SkeletonAnimationState | null
): CinemaRacers => {
  const racers = findCinemaRacers(archive, scene, worldObject)
  const drawings = new Map<CinemaRacer, FollowedDrawing | null>()
  const hosts: Group[] = []
  return Object.freeze({
    sync: () => {
      for (const racer of racers) {
        const isVisible = worldObject.group.visible && racer.group.visible
        if (!drawings.has(racer) && !isVisible) continue
        if (!drawings.has(racer)) {
          const host = new Group()
          host.matrixAutoUpdate = false
          three.add(host)
          hosts.push(host)
          drawings.set(racer, racer.create(host))
        }
        const state = getSkeletonState(racer.instance.name)
        drawings.get(racer)?.sync({
          matrix: worldObject.group.matrix
            .clone()
            .multiply(racer.group.matrix)
            .multiply(racer.getFrame(state)),
          isVisible,
          animationState: state,
        })
      }
    },
    dispose: () => {
      for (const drawing of drawings.values()) drawing?.dispose()
      for (const host of hosts) three.remove(host)
      drawings.clear()
    },
  })
}
