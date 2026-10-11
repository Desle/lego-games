import type { Chassis, ChassisVariant } from '../../../chassis-database/index.ts'
import { getRacerRecord } from '../../../racer-setup/index.ts'
import type { RacerDatabases } from '../../../racer-setup/index.ts'
import {
  DRIVER_ANIMATION_NAME,
  DRIVER_SKELETON_NAME,
  SHADOW_IMAGE_PREFIX,
} from '../../types/racer-appearance-names.ts'
import type { ModelResourceNames, RacerAppearance } from '../../types/racer-appearance.types.ts'

const getVariantModel = (variant: ChassisVariant): ModelResourceNames =>
  Object.freeze({
    textureDatabaseName: variant.textureDatabaseName,
    materialLibraryName: variant.materialLibraryName,
    modelName: variant.modelName,
    skeletonName: variant.skeletonName,
    animationName: variant.animationName,
  })

const getAppearance = (
  chassis: Chassis,
  racerIndex: number,
  bodyModel: ModelResourceNames | null,
  driverModel: ModelResourceNames | null
): RacerAppearance => {
  const [firstVariant, secondVariant] = chassis.variants
  if (firstVariant === undefined) throw new RangeError(`The chassis ${chassis.name} has no model`)
  const [x, y, z] = chassis.vehiclePoint
  return Object.freeze({
    bodyModel,
    wheelModel: getVariantModel(firstVariant),
    // 0x0041e360 builds a second variant when the chassis record's byte +0x28 (the second model's name) is set.
    secondWheelModel:
      secondVariant === undefined || secondVariant.modelName === ''
        ? null
        : getVariantModel(secondVariant),
    driverModel,
    seatPoint: Object.freeze({ x, y, z }),
    sharedResourceName: chassis.sharedResourceName,
    shadowImageName: `${SHADOW_IMAGE_PREFIX}${String(racerIndex)}`,
  })
}

// 0x0043b480 for a racer named in the driver database: the champion's body model, the chassis's wheels, and the
// driver's model with the pelvis skeleton and animation that Drivers_Load gives every driver.
export const getChampionRacerAppearance = (
  databases: RacerDatabases,
  driverName: string,
  racerIndex: number
): RacerAppearance => {
  const driver = getRacerRecord(databases.drivers.drivers, 'driver', driverName)
  const champion = getRacerRecord(databases.champions.champions, 'champion', driver.championName)
  const chassis = getRacerRecord(databases.chassis.chassis, 'chassis', champion.chassisName)
  return getAppearance(
    chassis,
    racerIndex,
    Object.freeze({
      textureDatabaseName: champion.textureDatabaseName,
      materialLibraryName: champion.materialLibraryName,
      modelName: champion.modelName,
      skeletonName: '',
      animationName: '',
    }),
    Object.freeze({
      textureDatabaseName: driver.textureDatabaseName,
      materialLibraryName: driver.materialLibraryName,
      modelName: driver.modelName,
      skeletonName: DRIVER_SKELETON_NAME,
      animationName: DRIVER_ANIMATION_NAME,
    })
  )
}

// 0x0043b480 for a racer with a car built from bricks: only the chassis's wheels are named by the databases; the car
// body and the driver come from the car builder and the figure builder.
export const getBuiltRacerAppearance = (
  databases: RacerDatabases,
  chassisName: string,
  racerIndex: number
): RacerAppearance =>
  getAppearance(
    getRacerRecord(databases.chassis.chassis, 'chassis', chassisName),
    racerIndex,
    null,
    null
  )
