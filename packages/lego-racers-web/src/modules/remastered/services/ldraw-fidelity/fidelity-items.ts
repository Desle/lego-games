import { BRICK_DATABASE_PATH, parseBrickDatabase } from '@lego-games/lego-racers/car-builder'
import { parseChassisDatabase } from '@lego-games/lego-racers/chassis-database'
import { parseDriverDatabase } from '@lego-games/lego-racers/driver-database'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { LDRAW_BRICK_MAPPINGS } from '../ldraw-car/ldraw-brick-mappings.ts'
import { LDRAW_COMPOSITE_MAPPINGS } from '../ldraw-car/ldraw-composite-mappings.ts'
import type { LDrawModelIndex } from '../ldraw-models/ldraw-model-index.types.ts'
import { LDRAW_PICKUP_MAPPINGS } from '../ldraw-pickup/ldraw-pickup-mappings.ts'
import { CHAMPION_CAR_CODES, CHASSIS_NAMES } from '../ldraw-racer-model/known-racer-models.ts'
import { FidelityItemKind, FidelityPose } from './ldraw-fidelity.types.ts'
import type { FidelityItem } from './ldraw-fidelity.types.ts'

const CHASSIS_DATABASE_PATH = 'GAMEDATA\\COMMON\\CHASSIS.CMB'
const DRIVER_DATABASE_PATH = 'GAMEDATA\\COMMON\\DRIVERS.DDB'
const DRAFT_FOLDER = 'drafts'

const createItem = (
  fields: Pick<FidelityItem, 'id' | 'kind' | 'name' | 'subject'> & Partial<FidelityItem>
): FidelityItem =>
  Object.freeze({
    file: null,
    chassisIndex: -1,
    partBytes: [],
    driverName: null,
    pose: null,
    ...fields,
  })

const getBrickItems = (archive: JamArchive): readonly FidelityItem[] =>
  parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH)).pieces.flatMap((piece) => {
    const isComposite = LDRAW_COMPOSITE_MAPPINGS[piece.name] !== undefined
    if (!isComposite && LDRAW_BRICK_MAPPINGS[piece.name] === undefined) return []
    const kind = isComposite ? FidelityItemKind.COMPOSITE : FidelityItemKind.BRICK
    return [
      createItem({ id: `${kind}:${piece.name}`, kind, name: piece.name, subject: piece.name }),
    ]
  })

const getChassisItems = (index: LDrawModelIndex): readonly FidelityItem[] =>
  CHASSIS_NAMES.map((name) =>
    createItem({
      id: `${FidelityItemKind.CHASSIS}:${name}`,
      kind: FidelityItemKind.CHASSIS,
      name,
      subject: name,
      file: index.chassis[name] ?? null,
    })
  )

const getPickupItems = (): readonly FidelityItem[] =>
  Object.keys(LDRAW_PICKUP_MAPPINGS).map((name) =>
    createItem({
      id: `${FidelityItemKind.PICKUP}:${name}`,
      kind: FidelityItemKind.PICKUP,
      name,
      subject: name,
    })
  )

// The champions' cars the models folder has, and (when asked) every draft of `drafts/` named after a car code (`RRCM-pilot.ldr` is RRCM's).
const getCarItems = (
  index: LDrawModelIndex,
  draftFiles: readonly string[]
): readonly FidelityItem[] => [
  ...CHAMPION_CAR_CODES.flatMap((code) => {
    const file = index.cars[code]
    return file === undefined
      ? []
      : [
          createItem({
            id: `${FidelityItemKind.CAR}:${code}`,
            kind: FidelityItemKind.CAR,
            name: code,
            subject: code,
            file,
          }),
        ]
  }),
  ...draftFiles.flatMap((file) => {
    const name = file.replace(/\.(ldr|mpd)$/i, '')
    const code = name.split('-')[0]?.toUpperCase() ?? ''
    return CHAMPION_CAR_CODES.includes(code)
      ? [
          createItem({
            id: `${FidelityItemKind.CAR}:${DRAFT_FOLDER}/${name}`,
            kind: FidelityItemKind.CAR,
            name: `${name} (draft)`,
            subject: code,
            file: `${DRAFT_FOLDER}/${file}`,
          }),
        ]
      : []
  }),
]

const getWheelItems = (archive: JamArchive): readonly FidelityItem[] =>
  parseChassisDatabase(archive.readFile(CHASSIS_DATABASE_PATH)).chassis.map(
    (chassis, chassisIndex) =>
      createItem({
        id: `${FidelityItemKind.WHEELS}:${chassis.name}`,
        kind: FidelityItemKind.WHEELS,
        name: chassis.name,
        subject: chassis.name,
        chassisIndex,
      })
  )

const POSES = Object.values(FidelityPose)

// Every driver of the driver database (a champion: his fixed model seated in the race, his part bytes standing), in every pose.
const getDriverItems = (archive: JamArchive): readonly FidelityItem[] =>
  parseDriverDatabase(archive.readFile(DRIVER_DATABASE_PATH)).drivers.flatMap((driver) =>
    POSES.map((pose) =>
      createItem({
        id: `${FidelityItemKind.DRIVER}:${driver.name}:${pose}`,
        kind: FidelityItemKind.DRIVER,
        name: `${driver.name} ${pose}`,
        subject: driver.name,
        partBytes: driver.unreadBytes,
        driverName: driver.name,
        pose,
      })
    )
  )

// Every replacement the remastered layer makes, in a fixed order.
export const listFidelityItems = (
  archive: JamArchive,
  index: LDrawModelIndex,
  draftFiles: readonly string[]
): readonly FidelityItem[] => [
  ...getBrickItems(archive),
  ...getChassisItems(index),
  ...getPickupItems(),
  ...getCarItems(index, draftFiles),
  ...getWheelItems(archive),
  ...getDriverItems(archive),
]
