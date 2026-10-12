// What tells a phone or a tablet from a desktop: a touch screen of a few CSS pixels across.
export type DeviceMetrics = {
  readonly touchPointCount: number
  readonly screenWidth: number
  readonly screenHeight: number
}
