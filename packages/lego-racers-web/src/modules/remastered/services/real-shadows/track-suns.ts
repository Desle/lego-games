import { getSunDirection } from './sun-direction.ts'
import type { SunEstimate, SunLight } from './real-shadows.types.ts'

// The sun each track is shadowed with, in the track's own frame, when it is not the default: chosen by eye on renders so the
// shadows fall to a side the chase camera sees (hypothesis: the baked colours say nothing about it, see the estimates below).
// Keys are the lower-case folder of the track's world.
export const TRACK_SUNS: Readonly<Record<string, SunLight>> = Object.freeze({
  racec0r0: { direction: getSunDirection(90, 45), ambientShare: 0.45 },
  racec0r1: { direction: getSunDirection(-60, 30), ambientShare: 0.45 },
  racec3r0: { direction: getSunDirection(0, 40), ambientShare: 0.45 },
  // The night forest: a high, faint moon, the shade nearly as bright as the lit ground.
  racec1r0: { direction: getSunDirection(90, 60), ambientShare: 0.55 },
})

// What `estimateSun` found on six tracks (`sun=estimate` uses these and runs the estimator for any other). The fit is the share
// of the brightness variance inside a material that the best light explains: 0.03 to 0.11, so the baked colours are not a
// directional light on the face normals and none of these is used by default.
export const TRACK_SUN_ESTIMATES: Readonly<Record<string, SunEstimate>> = Object.freeze({
  racec0r0: {
    direction: [-0.0787, -0.1832, 0.9799],
    ambientShare: 0.642,
    fit: 0.028,
    triangleCount: 4888,
  },
  racec0r1: {
    direction: [-0.2889, -0.8511, 0.4384],
    ambientShare: 0.761,
    fit: 0.038,
    triangleCount: 6415,
  },
  racec0r2: {
    direction: [0.1138, 0.2648, 0.9576],
    ambientShare: 0.379,
    fit: 0.077,
    triangleCount: 6711,
  },
  racec0r3: {
    direction: [0.0377, 0.1021, 0.9941],
    ambientShare: 0.452,
    fit: 0.073,
    triangleCount: 6626,
  },
  racec1r0: {
    direction: [0.0124, -0.0279, 0.9995],
    ambientShare: 0.25,
    fit: 0.112,
    triangleCount: 7196,
  },
  racec3r0: {
    direction: [-0.0817, -0.2632, 0.9613],
    ambientShare: 0.653,
    fit: 0.025,
    triangleCount: 5549,
  },
})
