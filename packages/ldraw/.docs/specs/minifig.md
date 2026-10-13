# Feature: minifig

## Behaviour

A generic LEGO minifigure skeleton. Where the library's minifigure parts sit when assembled, as the library's own complete figures stack them (hips, legs on the hip axle, torso, head, arms on the slanted shoulders and hands on the arms, with the hinge of each, in LDraw units with the hips' top as origin); what each part of a figure is (its role); and the figure posed as a real minifigure moves: legs swing on the hip axle, arms on their shoulder pins, the head on the neck and the hands on their wrist pins, each held to what LEGO's hinge allows.

## User flows

- **Assemble a figure**: the app reads `MINIFIG_GEOMETRY` for each part's matrix in the standing figure and its hinge (`MinifigHinge`), and `MINIFIG_SIDES` for the left and right side.
- **Know the parts**: the app passes a figure's parts (name and place) to `getMinifigRoles`, with its own hints by part index when its files name roles; a part with no hint is known by its library part number (a sided arm or hand by the side it sits on), anything else as worn on the head above the neck or held by the torso below it. `findMinifigRole` reads a role by its name.
- **Pose a figure**: the app builds a `MinifigPose` with `createMinifigPose` (joint angles, radians from the assembled figure, and a root matrix for the hips and torso), using `getHingeAngle` to swing a leg, an arm or the head toward a direction and `getTwistAngle` to take the twist of a turn about an axis; `poseMinifig` returns each role's matrix, which takes a part placed in the assembled figure to where the pose puts it.

## Invariants

- The offsets come from the library's complete figures (`15396c02`, `4480c05`, `980`, `973c01`), never from a game's model.
- `MINIFIG_JOINT_LIMITS` are LEGO's: a leg -110 to 60 degrees from hanging, an arm, the head and a hand all the way round. `poseMinifig` never turns a hinge past them, nor any part about anything but its own hinge.
- The rest pose keeps every part where the library assembles it, on the root.
- No game code: which parts and colours a game's figure uses, and how its skeleton drives the joints, stay in the app.

## Out of scope

Choosing parts and prints for a figure, rigging it to a game's skeleton, and drawing it.
