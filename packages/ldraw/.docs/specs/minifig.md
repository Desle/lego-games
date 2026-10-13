# Feature: minifig

## Behaviour

Where the library's minifigure parts sit when assembled, as the library's own complete figures stack them: hips, legs on the hip axle, torso, head, arms on the slanted shoulders and hands on the arms, with the hinge of each, in LDraw units with the hips' top as origin.

## User flows

- **Assemble a figure**: the app reads `MINIFIG_GEOMETRY` for each part's matrix in the standing figure and its hinge (`MinifigHinge`), and `MINIFIG_SIDES` for the left and right side.

## Invariants

- The offsets come from the library's complete figures (`15396c02`, `4480c05`, `980`, `973c01`), never from a game's model.
- No game code: which parts and colours a game's figure uses, and how they follow its skeleton, stay in the app.

## Out of scope

Choosing parts and prints for a figure, rigging it to a game's skeleton, and drawing it.
