// GhostRecorder_RecordSample 0x00422710 takes a sample every 0xfa milliseconds of the running clock (+0x3b0).
export const SAMPLE_INTERVAL_MILLISECONDS = 0xfa
// The recorder stores while the count is below 0x3c1.
export const MAXIMUM_RECORDED_SAMPLE_COUNT = 0x3c1
// Positions are stored as int16 of 32 · position (0x004b0188 = 32.0f); orientation bytes as 127 · component
// (0x004b018c = 127.0f).
export const POSITION_SCALE = 32
export const ORIENTATION_SCALE = 127
// FUN_00422960 plays nothing from 240,000 ms on.
export const MAXIMUM_PLAYBACK_MILLISECONDS = 240000
// The three leading integers of a ghost file are the lap times of its three laps (a time trial is three laps).
export const GHOST_LAP_COUNT = 3

// float32 0.004 (0x004b01a8, 1/250): the fraction of a sample interval per millisecond.
export const SAMPLE_FRACTION_PER_MILLISECOND = Math.fround(0.004)
// float32 1.8 (0x004b01a4) and 4.0 (0x004af674): the wheel speed FUN_00422960 derives from two samples.
export const SPEED_SCALE = Math.fround(1.8)
export const SPEED_INTERVAL_SCALE = 4
