// FrontEnd_PrepareRaceSettings 0x0042d730 builds the light set a car built from bricks and its driver are shown with: an
// ambient light of 0x808080 (0x0040eb70) and a white directional light shining along (-1, 0, -1) (0x0040eba0). The track
// worlds set no lights, so these are the only ones a model with normals can have in the race (hypothesis: the race keeps
// them).
export const BUILT_LIGHTS = Object.freeze({
  ambientLights: Object.freeze([Object.freeze({ color: [128, 128, 128] as const })]),
  directionalLights: Object.freeze([
    Object.freeze({
      color: [255, 255, 255] as const,
      direction: Object.freeze({ x: -1, y: 0, z: -1 }),
    }),
  ]),
})
