// Half the width of the square of track the shadow map covers, in world units (a stud is 1; a track is thousands).
export const SHADOW_RADIUS = 80
export const SHADOW_MAP_SIZE = 2048
// The map is centred this far ahead of the camera along its view direction.
export const SHADOW_FOCUS_AHEAD = 25
export const SHADOW_DEPTH_BIAS_TEXELS = 1.5
// 1 removes all the baked sun from the blocked places.
export const SHADOW_STRENGTH = 1
// The LDraw plastic reads the live map from this far towards the sun (world units): past its own car, which is in the map too.
export const PLASTIC_LIVE_SHADOW_LIFT = 6
// The baked map is read this many of its texels towards the sun: off the ground the wheels stand on.
export const PLASTIC_BAKED_SHADOW_LIFT_TEXELS = 2
