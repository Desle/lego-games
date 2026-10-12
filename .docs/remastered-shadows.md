# Real shadows (remastered layer)

With `?hd` in development, races get real shadows. Everything lives in `packages/lego-racers-web/src/modules/remastered/services/real-shadows/`. Read [remastered.md](remastered.md) first for the rule.

## Choices

`shadows=classic` keeps the original's blob decals (`carshadN`), `shadows=real` (the default with `?hd`) draws real shadows and hides the blobs, `shadows=scenery` also lets the static scenery (the BSP tree: walls, bridge posts, rails; and the plain mesh instances) cast. The developer panel's **Shadows (reloads)** selector sets the parameter (Classic blobs / Real / Real + scenery). `sun=<azimuth>,<elevation>[,<ambient share>]` overrides the sun (degrees, in the track's own frame: azimuth from +x towards +y, elevation above the horizon); `sun=estimate` uses the estimator.

## How it works

- Neutral extension point `ViewerExtension.getRaceRenderPass(request)`: the race viewport asks each extension for a pass when it is made and calls `beforeRender()` before every frame; with no extension nothing changes. Two neutral tags go with it: the track's instance groups carry `userData.instanceKind`, and the blob decal meshes are named `RACER_SHADOW_DECAL_NAME`.
- Shadow map: one depth map (2048 x 2048, hardware comparison, `LessEqualCompare`) drawn from the sun with an orthographic camera 160 units wide, centred 25 units ahead of the camera and moved in whole texels along the light's axes (the map does not shimmer when the camera turns or moves). Casters are every solid mesh of the track scene except the track's static instances, decals, particles and blended meshes (shields, explosions, glass): cars (Classic or LDraw), wheels, drivers, power-up bricks, projectiles, and the track's skeleton instances (hazards).
- Receivers: the track's own opaque materials. They stay `MeshBasicMaterial` (baked colour, no lights); `onBeforeCompile` multiplies the colour by a shade factor from the map. Nothing is lit twice. The shade factor is the baked light's own ratio: the baked brightness is `ambient + diffuse * cos`, so where the sun is blocked a surface that faces the sun by `cos` keeps `ambient / (ambient + diffuse * cos)` of it; surfaces turned from the sun are unchanged. PCF is 3 x 3 taps of the hardware-filtered comparison, normal-offset by two texels and depth-biased by 1.5 texels; the map fades out near its edge.
- Cost: a depth-only draw of the casters (about 8 racers' meshes), one 4 MB depth target, and 9 taps per track fragment. Measured on the development Mac (headless Chrome, GPU, 640 x 480, Royal Knights frames 150 to 249 with all eight racers, Classic bricks): no difference above the noise (2.2 s for 100 rendered frames, including the simulation and the pixel read-back, with blobs, with real shadows and with scenery). Scenery mode adds the visible BSP leaves to the depth draw.

## The sun: what the baked colours say (hypothesis)

The brief asked for the sun to be estimated from the prelit colours. `estimateSun` does that (`sun-estimation.ts`: weighted least squares of each triangle's brightness against `max(0, normal . direction)` inside each material, so a material's own colour does not count; a 6 degree grid over the hemisphere, then a fine search; the spec recovers a synthetic sun within 3 degrees) and was run on six tracks (`TRACK_SUN_ESTIMATES`): the best light explains only 2.5 to 11 percent of the variance (the track's materials, all prelit, show no consistent gradient along any direction: the colours are authored, not N . L). So **the estimate is not trusted** and is not the default: every track uses `DEFAULT_SUN` (azimuth -60, elevation 55 degrees, ambient share 0.45) unless `TRACK_SUNS` has it (four tracks: Royal Knights, the pirate bridge, the space station and the night forest with a faint high moon). Stored values are chosen by eye on renders so the shadows fall to a side the chase camera sees. A better source would be the sky's sun or moon position (not read yet), or the baked cast shadows of tall scenery.

## Open

- Sun directions per track are a choice, not recovered; the shadow direction can disagree with the sky.
- The warp tunnel and effect models cast nothing; shields and glass cast nothing; alpha-tested casters (none seen) would cast their whole quad.
- A track's baked shadows (if any) stay and are darkened again where a car's shadow falls on them.
