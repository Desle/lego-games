// The states of every hazard object (+0x0c): 0 not loaded, 1 idle, 2 active, 3 asked to end at its next update.
// The numbers are the original's; the names describe what the code does with them.
export const HazardLifecycle = Object.freeze({
  UNLOADED: 0,
  IDLE: 1,
  ACTIVE: 2,
  ENDING: 3,
})
