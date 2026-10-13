# LDraw racer models

Hand-built LDraw models for the cars of LEGO Racers. The viewer reads this folder in development, with `?hd` (the remastered layer). `LEGO_LDRAW_MODELS_ROOT` moves it; the default is `~/ldraw-models`. This file is written by `pnpm --filter @lego-games/lego-racers-web run reference-kit`, which also writes `reference/`, `chassis/_fallback/` and `_convention-test.ldr`.

## What goes where

| File                                      | What it is                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `<CODE>.ldr` or `<CODE>.mpd`              | A whole champion car, by the body code of its model (below). The `.ldr` wins over the `.mpd`. |
| `chassis/<CHASSIS>.ldr`                   | A recipe for one of the 12 chassis parts, built from standard parts. Cars refer to it.        |
| `drivers/<NAME>.ldr`                      | A driver's minifigure, by the name of his record in the driver database (below).              |
| `reference/<CODE>.svg`, `.txt`            | The reference sheet of a champion's car (below).                                              |
| `reference/chassis/<CHASSIS>.svg`, `.txt` | The reference sheet of a chassis.                                                             |
| `chassis/_fallback/<CHASSIS>.dat`         | The unofficial LDraw part the converter makes from the game's own geometry (a stand-in).      |
| `_convention-test.ldr`                    | A tiny model that proves the conventions below (open it in any LDraw viewer).                 |

Files that begin with an underscore are never used as models. File names are not case sensitive. Reload the page after adding or changing a file.

**Car codes** (the model names of `CHAMPS.CCB`): VVCM RRCM BKCM RKCM RHCM CCCM ACM PHCM GBCM BHCM SSCM TCCM NHCM APCM KKCM CRCM BVBCM JTCM BBCM GMCM.

**Chassis names** (the chassis parts of the game): JTchas0 GM_CHAS0 BVBCHA0 BBCHAS0 CRchas0 KKCHAS0 DACHAS0 DBCHAS0 DCCHAS0 DDCHAS0 RRchas0 VVCHAS0.

## The frame

A car is built in the game's own frame, written in LDraw's axes and units. Everything in the reference sheets is in this frame.

- **Units**: LDraw units (LDU). A stud is 20 LDU, a plate 8 LDU (0.4 stud), a brick 24 LDU (1.2 studs). The sheets give studs: multiply by 20.
- **Axes**: in the game x is forward, y to the car's left and z up. In the file, x is LDraw's x, y (down) is minus the car's z, and z is the car's y: a point at (x, y, z) studs is `20 x`, `-20 z`, `20 y` in LDU. So in LDraw's usual view the car's front is to the right and its left side faces you.
- **Origin**: the car's origin, the red cross of the sheets: the chassis part's origin vertex (`getCarOrigin`, 0x0049b340), which the car's mesh, the wheel model and the seat share.
- **Front**: +x. The wheels' axles run along y.
- `_convention-test.ldr` puts a red brick on the origin cell, a white block at the front (x 8 to 10 studs), a blue brick 2 studs to the left and a tower of three yellow bricks upward. A spec (`convention-test-model.spec.ts`) checks that the loader turns every marker into the position it names.

## What to include

- **The body and the chassis.** Build what the sheet shows, in the sheet's colours (the LDraw colour names are listed on each sheet). Use colour 16 where the part takes the colour its parent gives it.
- **Wheels: optional.** If the file has none, the game's LDraw wheels (the tyre and rim sets of the library, sized to the game's wheel) are added at the wheel mounts and spin and steer with the game's animation. If it has some (parts of the library's `Wheel` or `Tyre` category), they are found, taken out of the body, and each one follows the game's wheel nearest to it. Build them at rest at the wheel mounts of the sheet.
- **A minifigure: leave it out.** The driver is drawn apart, from his own file `drivers/<NAME>.ldr` (below), and posed by the game's skeleton, seated in the car or standing in a menu. A minifigure in a car file is removed.
- **The chassis by reference.** The chassis recipe is placed with the reference line printed on the champion's sheet (`1 16 <x> <y> <z> 1 0 0 0 1 0 0 0 1 <chassis>.ldr`). The champion's body model already contains the chassis frame, so a car file either refers to the recipe or builds the whole shape itself, not both.

## Chassis recipes

A chassis recipe has its own frame: **the corner of the chassis brick's footprint is the origin, x along the width, y along the depth, z up from the brick's bottom**, in studs on the sheet. The file is written as a car file is: a point at (x, y, z) studs is `20 x`, `-20 z`, `20 y` in LDU, so the reference line is a plain translation. The car's origin lies at the offset the sheet prints. The same recipe serves two kinds of car:

- a hand-built car refers to it with the line from the sheet;
- a car built in the garage whose design names the chassis uses it automatically, in the place the game puts the chassis brick, with the bricks placed on it.

**Grid alignment.** A recipe may be a single real car base. The viewer measures the base's studs (its highest points: wheel holders and pins that reach past them do not count) and moves every brick built on it so the game's grid (10 x 6 cells) is centred on the studs, cell edges on stud edges, and the first layer rests on the base's deck (the deck height most attachable cells have). The base's deck is flat, so the bricks are dropped again onto it in the order they were placed: a brick the game set on a raised or sunken cell of its chassis sits on the deck, with what is built on it. The game's attachable cells span the 4 middle rows of the grid, so a base 4 studs wide (4212a, 4212b, 30029) carries every brick; a narrower one leaves the outer bricks in the air. Wheels stay at the game's centres; the recipe's own position only has to put the base between them.

A garage car is complete LDraw once its chassis has a recipe. Until then it is drawn by the original (never half and half). **Fallback (a toggle, not the default):** the developer panel's "Chassis without a recipe" (or `?hd&chassis=game`) draws such a chassis from the game's own geometry, converted to an unofficial LDraw part with a stud on every flat cell of its top (the files in `chassis/_fallback/` are the same conversion).

## Wheel mounts

The sheets list the four wheels of a chassis in the car's frame: centre (x, y, z), diameter, width, and the axle (always y). The library wheels the game adds sit exactly there, so a body needs room for a wheel of that size at that place (the blue dashed outlines in the views). A wheel you build yourself must be centred there too, with its axle along y; spin and steering turn it about its own centre.

## The driver's seat

The race seats the driver at the chassis's seat point, which the sheets print and mark with a green ring. Build the steering wheel in front of it: the driver is drawn there whatever the model does. Most chassis seat the driver on the centre line; **JTchas0 and BVBCHA0 seat it a stud to the car's left** (y 1.04 and 1.01 studs: left-hand drive, as the game's own models draw their steering wheel), so Johnny Thunder's and Baron von Barron's cars, and every garage car on those chassis, need the wheel there too (LDraw z about 20 in a car file, about 80 in those chassis recipes). `pnpm run hd-coverage` notes every model whose steering wheel is not in front of the seat.

## Reference sheets

`reference/<CODE>.svg` shows the original body in four orthographic views (side from the left, top, front, back) over a grid of studs (a line at every whole stud, labelled every 5, the origin a red cross), the wheel mounts, the overall size in studs, plates and bricks, and the colours as LDraw names with their share of the surface. Open the `.svg` in a browser. The `.txt` next to it has the same numbers as text. The sheets are rendered from the game's models: the printed logos and decals are not drawn, the studs are left out.

## Official sets

The LDraw Official Model Repository (OMR) has no set for any car of the game: the 1999 game predates its themes, and none of the 1,470 sets it holds is a LEGO Racers car. A model of a real set can still be used: save it as `<CODE>.mpd` and move it into the frame above.

## Drivers

`drivers/<NAME>.ldr` is a driver's minifigure (**driver names**: RR VV AD IL WW GS BK RK RH AL CC PH GB BH SB TC NH AP KK CR BVB JT BB GM). It stands in the rest pose, arms down, its origin the top of the hips (`3815b`'s own origin), in LDraw axes (y down, the figure faces -z). Each part line follows `0 !RACERS ROLE <hips|left-leg|right-leg|torso|head|hat|accessory|left-arm|right-arm|left-hand|right-hand>`: the bone of the game's skeleton it moves with (a part with no ROLE line is known by its minifigure part number). The colours are the file's. A head or torso with no print of its own (`3626b`, `3626c`, `973`) shows the game's picture of the face or the chest; a printed part keeps its print. A driver with no file is drawn as in the original game.
