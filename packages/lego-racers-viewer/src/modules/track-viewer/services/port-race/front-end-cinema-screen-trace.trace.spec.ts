import {
  getActiveCinemaActions,
  getCinemaActionMilliseconds,
  parseCinemaDatabase,
} from '@lego-games/lego-racers/cinema'
import { loadRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  getFrontEndFrame,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type {
  CinemaSource,
  FrontEndEnvironment,
  FrontEndState,
  RaceCinemaView,
} from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import type { OriginalDraw } from '@lego-games/lego-racers/presentation-trace'
import { loadScene } from '@lego-games/lego-racers/scene'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import { getCinemaCamera } from '../cinema-stage/cinema-camera.ts'
import { getCinemaWorldPaths } from '../cinema-stage/cinema-source.ts'
import { getDistance, invert, multiply } from './figure-frames.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const PUSH_FRAME = 200
const EYE_TOLERANCE = 0.05
const POSITION_TOLERANCE = 0.03
const MATCHED_SHARE = 0.9
const FIGURE_RADIUS = 3

type CinemaCase = {
  readonly name: string
  readonly screenId: number
  readonly source: CinemaSource
  readonly frames: readonly number[]
  readonly isFigureChecked: boolean
}

// The figure is compared where it is the world's guy1 on the action's place (circuits 1, 4 and 5); the other cinemas build it
// differently (hypothesis: the driver is a built figure, not the world's mesh), so only their eye is compared.
// Full-screen cinemas the keys cannot reach, pushed on the screen stack by the harness: the eye the original draws from and the
// part frames of its guy1 against the port's camera (the world's camera carried by the camera skeleton) and skeleton.
const CASES: readonly CinemaCase[] = [
  {
    name: 'circuit 1 introduction',
    screenId: 0x1f,
    source: { directory: 'CIRCUIT1', fileName: 'CIR1-01' },
    frames: [205, 230, 300, 400, 420, 520, 640],
    isFigureChecked: true,
  },
  ...[
    ['circuit 2 introduction', 0x20, 'CIRCUIT2', 'TEST'],
    ['circuit 3 introduction', 0x21, 'CIRCUIT3', 'CIR3-01'],
    ['circuit 4 introduction', 0x22, 'CIRCUIT4', 'CIR4-01'],
    ['circuit 5 introduction', 0x23, 'CIRCUIT5', 'CIR5-01'],
    ['circuit 6 introduction', 0x24, 'CIRCUIT6', 'TEST'],
    ['circuit 7 introduction', 0x25, 'CIRCUIT7', 'FR'],
    ['first place award', 0x16, 'C_AWARD1', '1STPLACE'],
    ['second place award', 0x17, 'C_AWARD2', 'TWO'],
    ['third place award', 0x18, 'C_AWARD3', '3-01'],
    ['losing award', 0x19, 'C_AWARD4', 'LOSE'],
    ['winning car', 0x1a, 'WINCAR', 'WINCAR'],
    ['Rocket Racer winning car', 0x1b, 'WINRRCAR', 'END'],
    ['VV winning car', 0x1c, 'WINVVCAR', 'VVWIN'],
  ].map(([name, screenId, directory, fileName]): CinemaCase => ({
    name: String(name),
    screenId: Number(screenId),
    source: { directory: String(directory), fileName: String(fileName) },
    frames: [205, 240, 290, 340, 400],
    isFigureChecked: ['CIRCUIT4', 'CIRCUIT5'].includes(String(directory)),
  })),
]

const archive = openJamArchive(readOriginalJam())
const resources = loadFrontEndResources(archive)
const environment: FrontEndEnvironment = {
  controllerCount: 1,
  unlockedCircuitMask: 0x7f,
  randomTable: loadRandomTable(readOriginalExecutable()),
  isEveryPartUnlocked: true,
  playerRacerNames: [],
  standingRows: [],
}

const getOriginalEye = (draws: readonly OriginalDraw[]): readonly number[] | null => {
  const draw = draws.find(
    (candidate) =>
      candidate.clipMatrix.length === 16 &&
      candidate.vertices.length > 12 &&
      candidate.indices !== null
  )
  if (draw === undefined) return null
  const inverse = invert(draw.clipMatrix)
  const row = [inverse[8] ?? 0, inverse[9] ?? 0, inverse[10] ?? 0, inverse[11] ?? 0]
  return row.slice(0, 3).map((value) => value / (row[3] ?? 1))
}

const getCinemaView = (state: FrontEndState): RaceCinemaView | null => {
  for (const command of getFrontEndFrame(state, resources, environment).commands) {
    if (command.kind === 'viewport' && command.cinema !== null) return command.cinema
  }
  return null
}

const getPortFigure = (
  scene: ReturnType<typeof loadScene>,
  action: NonNullable<ReturnType<typeof getActiveCinemaActions>[number]>,
  milliseconds: number
): readonly (readonly number[])[] => {
  const instance = scene.instances.find((candidate) => candidate.name === action.instanceName)
  const level = instance?.levels[0]
  const skeleton = scene.skeletons[level?.skeletonIndex ?? -1]?.skeleton
  const animation = scene.animations[level?.animationIndex ?? -1]?.animation
  if (skeleton === undefined || animation === undefined) return []
  const matrices = getBoneMatrices(
    skeleton,
    getSkeletonPose(
      getRestPose(skeleton),
      animation,
      advanceSkeletonAnimation(
        createSkeletonAnimationState(animation, action.flag),
        animation,
        milliseconds
      )
    )
  )
  const [forwardX, forwardY, forwardZ] = action.forward
  const [upX, upY, upZ] = action.up
  const sideX = upY * forwardZ - upZ * forwardY
  const sideY = upZ * forwardX - upX * forwardZ
  const sideZ = upX * forwardY - upY * forwardX
  return Array.from({ length: matrices.length / 16 }, (_, bone) => {
    const x = matrices[bone * 16 + 12] ?? 0
    const y = matrices[bone * 16 + 13] ?? 0
    const z = matrices[bone * 16 + 14] ?? 0
    return [
      action.position[0] + x * forwardX + y * sideX + z * upX,
      action.position[1] + x * forwardY + y * sideY + z * upY,
      action.position[2] + x * forwardZ + y * sideZ + z * upZ,
    ]
  })
}

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end full-screen cinemas',
  () => {
    // eslint-disable-next-line no-restricted-syntax -- the test body is a block of steps
    it.each(CASES)('$name: the camera and the figure follow the original', async (cinemaCase) => {
      // Arrange
      const lastFrame = Math.max(...cinemaCase.frames)
      const original = await readOriginalFrontEnd({
        name: cinemaCase.name,
        frames: Array.from({ length: lastFrame + 1 }, () => ({
          milliseconds: FRAME_MILLISECONDS,
          scanCodes: [],
        })),
        recordFrames: cinemaCase.frames,
        isRenderRecorded: true,
        pushScreens: [{ frame: PUSH_FRAME, screenId: cinemaCase.screenId }],
      })
      const scene = loadScene(archive, getCinemaWorldPaths(archive, cinemaCase.source), [
        'MENUDATA\\PARTDB',
      ])
      const cinema = parseCinemaDatabase(
        archive.readFile(
          `MENUDATA\\${cinemaCase.source.directory}\\${cinemaCase.source.fileName}.CDB`
        )
      ).cinemas[0]
      if (cinema === undefined) throw new RangeError('The file has a cinema')
      const created = createFrontEnd(resources, environment)
      let state: FrontEndState = {
        ...created,
        screens: [
          {
            screenId: cinemaCase.screenId,
            selection: created.screens[0]?.selection ?? {
              focusIndex: 0,
              circuitIndex: 0,
              raceIndex: 0,
              racerIndex: 0,
              tabIndex: 0,
              isDialogOpen: false,
              text: '',
            },
          },
        ],
      }
      let steps = 0

      // Act
      const results = cinemaCase.frames.map((frame) => {
        while (steps < frame - PUSH_FRAME) {
          steps += 1
          state = stepFrontEnd(state, resources, environment, null, FRAME_MILLISECONDS).state
        }
        const view = getCinemaView(state)
        const milliseconds = view?.milliseconds ?? 0
        const actions = getActiveCinemaActions(cinema, milliseconds)
        const camera = getCinemaCamera(scene, cinema, milliseconds)
        const draws =
          original.renderFrames.find((candidate) => candidate.frame === frame)?.draws ?? []
        const eye = getOriginalEye(draws)
        const guy = actions.find((action) => action.instanceName.startsWith('guy'))
        const bones =
          guy === undefined
            ? []
            : getPortFigure(scene, guy, getCinemaActionMilliseconds(cinema, guy, milliseconds))
        // The world's own figure draws with a unit scale: the part frames within three units of the action's place.
        const figurePositions = draws
          .flatMap((draw) =>
            draw.modelMatrix.length === 16 && draw.clipMatrix.length === 16
              ? [multiply(draw.modelMatrix, invert(draw.clipMatrix)).slice(12, 15)]
              : []
          )
          .filter(
            (position, index, all) =>
              guy !== undefined &&
              getDistance(position, guy.position) < FIGURE_RADIUS &&
              all.findIndex((other) => getDistance(other, position) < 0.001) === index
          )
        const matched = figurePositions.filter((position) =>
          bones.some((bone) => getDistance(bone, position) < POSITION_TOLERANCE)
        )
        return {
          eyeDistance:
            eye === null || camera === null
              ? Number.POSITIVE_INFINITY
              : getDistance(eye, [camera.position.x, camera.position.y, camera.position.z]),
          figureShare: matched.length / Math.max(1, figurePositions.length),
          figureCount: figurePositions.length,
        }
      })

      // Assert
      expect(Math.max(...results.map((result) => result.eyeDistance))).toBeLessThan(EYE_TOLERANCE)
      if (cinemaCase.isFigureChecked)
        expect(
          Math.min(...results.map((result) => (result.figureCount === 0 ? 1 : result.figureShare)))
        ).toBeGreaterThan(MATCHED_SHARE)
    })
  }
)
