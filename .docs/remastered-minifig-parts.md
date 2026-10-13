# Remastered minifigure parts (review table)

Every part of the game's figure builder (`BODYPART.PCB`: 36 hats, 30 faces, 29 torsos, 20 legs) and the LDraw part that stands for it in the remastered layer (`?hd`, Bricks = LDraw). The data is `driver-catalogue-mappings.ts` in `packages/lego-racers-web/src/modules/remastered/services/ldraw-racer/`: correct a row there (part number, colour code) and re-run the gallery. It draws every driver who has no file `drivers/<NAME>.ldr` in the models folder (a figure the player built in the figure builder); a champion with a file is drawn from his file. Classic is untouched.

**Confidence.** `exact`: the official figure of that character carries this very part (the part lists are Rebrickable's public CSV downloads, `~/ldraw/rebrickable`; Rebrickable and LDraw numbers are joined through the `Rebrickable` keywords in the LDraw part headers). `close`: same theme and era, a print that reads like the game's picture. `guess`: nearest print by look only; please correct. Character names (`kk` King Kahuka ...) are **hypotheses** read off the part prefixes and the pictures, they are not in the game files. Colours are LDraw codes. A torso with no print keeps the game's picture, clipped to the front of the torso.

## Champions (`DRIVERS.DDB`: hat, face, torso, legs)

| Driver | Character (hypothesis) | Bytes       | Hat                                     | Face     | Torso        | Legs     |
| ------ | ---------------------- | ----------- | --------------------------------------- | -------- | ------------ | -------- |
| RR     | Rocket Racer           | 1 28 15 18  | 3842a black (0) + 2447 trans-black      | 3626cp40 | game picture | 3817b    |
| VV     | Veronica Voltage       | 35 29 28 19 | 3842a light gray (7) + 2447 trans-black | 3626bp09 | 973p29       | 3817b    |
| AD     | ?                      | 31 20 17 15 | 24073 green (2)                         | 3626bp64 | game picture | 3817b    |
| IL     | ?                      | 19 13 18 17 | 2545 black (0)                          | 3626bp3j | 973p3j       | 3817cp3j |
| WW     | ?                      | 18 12 20 0  | 6131 black (0)                          | 3626bp4f | 973p4k       | 3817b    |
| GS     | ?                      | 9 27 19 11  | 30172 white (15)                        | 3626bpao | game picture | 3817b    |
| BK     | Black Knight?          | 25 17 25 1  | 4503 black (0) + 87693 red (4)          | 3626bp4m | 973pfb       | 3817b    |
| RK     | a king (lion)?         | 23 15 6 11  | 71015 yellow (14)                       | 3626bp4d | 973p4e       | 3817b    |
| RH     | Robin Hood?            | 34 14 9 7   | 4506c01 green (2)                       | 3626bp3e | 973pf8       | 3817b    |
| AL     | ?                      | 24 16 8 9   | 13788 black (0)                         | 3626bp44 | 973p3f       | 3817b    |
| CC     | ?                      | 12 10 11 2  | 22380 white (15) + 2447 red (4)         | 3626bp61 | 973p62       | 3817b    |
| PH     | Pharaoh Hotep          | 26 18 27 14 | 30168b yellow (14)                      | 3626bpa2 | 973pa2       | 3817cpa2 |
| GB     | a governor (Pirates)?  | 5 6 16 12   | 2528a white (15)                        | 3626bp07 | game picture | 3817b    |
| BH     | ?                      | 27 19 10 9  | 2544 black (0)                          | 3626bp39 | 973p39       | 3817b    |
| SB     | ?                      | 8 7 14 0    | 3878 black (0)                          | 3626bpa9 | 973p22       | 3817b    |
| TC     | a tribal chief?        | 10 8 13 13  | 6025 black (0) + 87696 red (4)          | 3626bpac | 973pac       | 3817cp3j |
| NH     | ?                      | 14 11 7 6   | 30124b black (0) + 2447 trans-black     | 3626bp41 | 973p55       | 3817b    |
| AP     | ?                      | 11 9 12 16  | 30120 black (0)                         | 3626bpw4 | game picture | 3817b    |
| KK     | King Kahuka            | 7 1 1 17    | 6030 red (4) + 87696 white (15)         | 3626bp3k | 973p3h       | 3817cp3j |
| CR     | Captain Redbeard       | 4 4 24 10   | 2528ap3d black (0)                      | 3626bp47 | 973p36       | 3817b    |
| BVB    | Baron Von Barron       | 9 21 4 9    | 30172 white (15)                        | 3626bpa7 | 973pa7       | 3817b    |
| JT     | Johnny Thunder         | 6 2 3 0     | 30167 brown (6)                         | 3626bpa3 | 973pa3       | 3817b    |
| BB     | Basil the Batlord      | 3 5 2 5     | 30105 black (0)                         | 3626bp4c | 973p4i       | 3817b    |
| GM     | Gypsy Moth             | 0 3 5 6     | none                                    | 3626bp53 | 973p58       | 3817b    |

## Hats

| #   | Game part | LDraw part and colour                   | Confidence | Source                                                                                                 |
| --- | --------- | --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| 0   | nohat     | none                                    | exact      | bare head                                                                                              |
| 1   | helmtrr   | 3842a black (0) + 2447 trans-black      | close      | classic racing helmet, Racers                                                                          |
| 2   | helmet2s  | 3896 black (0)                          | close      | castle helmet with chin guard, Castle                                                                  |
| 3   | bb_hats   | 30105 black (0)                         | exact      | fig-000648 Bat Lord, Fright Knights                                                                    |
| 4   | cr_hats   | 2528ap3d black (0)                      | exact      | fig-005505 Captain Redbeard (21322): bicorne with skull and bones                                      |
| 5   | gb_hats   | 2528a white (15)                        | guess      | Imperial governor bicorne, Pirates                                                                     |
| 6   | jt_hats   | 30167 brown (6)                         | exact      | fig-000359 Johnny Thunder (5938 Oasis Ambush, 1998)                                                    |
| 7   | kk_hats   | 6030 red (4) + 87696 white (15)         | exact      | fig-001092 King Kahuka (6236, 1994): mask and plume                                                    |
| 8   | sb_hats   | 3878 black (0)                          | close      | top hat                                                                                                |
| 9   | vb_hats   | 30172 white (15)                        | exact      | fig-000629 Baron Von Barron (5948 Desert Expedition, 1998): pith helmet                                |
| 10  | tc_hats   | 6025 black (0) + 87696 red (4)          | guess      | islander hair under a band of feathers (fidelity: the warbonnet 30138 trailed 1.5 times too long)      |
| 11  | ap_hats   | 30120 black (0)                         | guess      | hexagonal helmet, the shape of the cobra helm (fidelity), no cobra helm in the library                 |
| 12  | cc_hats   | 22380 white (15) + 2447 red (4)         | guess      | space helmet with a red visor (fidelity)                                                               |
| 13  | ch_hats   | 3629 white (15)                         | close      | cowboy hat, Western                                                                                    |
| 14  | nh_hats   | 30124b black (0) + 2447 trans-black     | guess      | space helmet with its visor                                                                            |
| 15  | gh_hai1s  | 6093a light gray (7)                    | close      | hair with a ponytail (fidelity)                                                                        |
| 16  | gh_hai2s  | 6093a brown (6)                         | close      | hair with a ponytail (fidelity)                                                                        |
| 17  | gh_hairs  | 6093a black (0)                         | close      | hair with a ponytail (fidelity)                                                                        |
| 18  | ww_hats   | 6131 black (0)                          | close      | wizard hat                                                                                             |
| 19  | il_hairs  | 2545 black (0)                          | guess      | tall flat hat: shako (fidelity)                                                                        |
| 20  | mh_hairs  | 30608 black (0)                         | close      | flat top hair (fidelity)                                                                               |
| 21  | mh_hai1s  | 30608 light gray (7)                    | close      | flat top hair (fidelity)                                                                               |
| 22  | mh_hai2s  | 30608 brown (6)                         | close      | flat top hair (fidelity)                                                                               |
| 23  | rk_hats   | 71015 yellow (14)                       | guess      | crown (fidelity)                                                                                       |
| 24  | al_hats   | 13788 black (0)                         | guess      | wide brimmed hat                                                                                       |
| 25  | bk_hats   | 4503 black (0) + 87693 red (4)          | close      | castle helmet with grille and its red plume, Castle                                                    |
| 26  | pm_hats   | 30168b yellow (14)                      | exact      | fig-000526 Pharaoh Hotep (5988, 1998): nemes headdress (the blue and gold print is not in the library) |
| 27  | bj_hats   | 2544 black (0)                          | close      | tricorne, Pirates                                                                                      |
| 28  | helmt03   | 3842a blue (1) + 2447 trans-black       | close      | classic racing helmet, Racers                                                                          |
| 29  | helmt02   | 3842a red (4) + 2447 trans-black        | close      | classic racing helmet, Racers                                                                          |
| 30  | helmt01   | 3842a white (15) + 2447 trans-black     | close      | classic racing helmet, Racers                                                                          |
| 31  | ad_hats   | 24073 green (2)                         | guess      | close-fitting wrap (fidelity), robot top not in the library                                            |
| 32  | mm_hats   | 86035 blue (1)                          | close      | cap, Racers                                                                                            |
| 33  | mj_hats   | 6131 blue (1)                           | close      | wizard hat                                                                                             |
| 34  | rh_hats   | 4506c01 green (2)                       | close      | forestman cap with plume, Castle                                                                       |
| 35  | helmtvvs  | 3842a light gray (7) + 2447 trans-black | close      | classic racing helmet, Racers                                                                          |

## Faces

| #   | Game part | LDraw head and colour   | Confidence | Source                                                            |
| --- | --------- | ----------------------- | ---------- | ----------------------------------------------------------------- |
| 0   | lh_       | 3626bp01 yellow (14)    | guess      | standard grin                                                     |
| 1   | kk_       | 3626bp3k yellow (14)    | exact      | fig-001092 King Kahuka (6236, 1994): white and blue face paint    |
| 2   | jt_       | 3626bpa3 yellow (14)    | exact      | fig-000359 Johnny Thunder (5938, 1998)                            |
| 3   | gm_       | 3626bp53 blue (1)       | exact      | fig-000451 Gypsy Moth (3073 Booster, 1999)                        |
| 4   | cr_       | 3626bp47 yellow (14)    | close      | Pirates: eye patch on the right, red moustache and beard          |
| 5   | bb_       | 3626bp4c yellow (14)    | exact      | fig-000648 Bat Lord, Fright Knights                               |
| 6   | gb_       | 3626bp07 yellow (14)    | guess      | freckles: the game shows orange cheeks                            |
| 7   | sb_       | 3626bpa9 yellow (14)    | guess      | glasses and black facial hair                                     |
| 8   | tc_       | 3626bpac yellow (14)    | guess      | tribal paint and frown                                            |
| 9   | ap_       | 3626bpw4 yellow (14)    | guess      | orange war paint, Western                                         |
| 10  | cc_       | 3626bp61 yellow (14)    | guess      | white moustache and eyebrows, Ice Planet                          |
| 11  | nh_       | 3626bp41 yellow (14)    | guess      | red moustache and goatee                                          |
| 12  | ww_       | 3626bp4f yellow (14)    | guess      | messy black hair, one tooth                                       |
| 13  | il_       | 3626bp3j yellow (14)    | close      | white and red face paint, Islanders                               |
| 14  | rh_       | 3626bp3e yellow (14)    | guess      | wiry moustache, goatee and eyebrows                               |
| 15  | rk_       | 3626bp4d yellow (14)    | guess      | red moustache, eyebrows and hair                                  |
| 16  | al_       | 3626bp44 yellow (14)    | guess      | black moustache, beard and messy hair                             |
| 17  | bk_       | 3626bp4m yellow (14)    | guess      | black bushy moustache and hair                                    |
| 18  | pm_       | 3626bpa2 light gray (7) | exact      | fig-000526 Pharaoh Hotep (5988, 1998)                             |
| 19  | bj_       | 3626bp39 yellow (14)    | guess      | grin, dark grey beard and eyebrows                                |
| 20  | ad_       | 3626bp64 black (0)      | close      | robot with gold circuitry on black, Insectoids                    |
| 21  | vb_       | 3626bpa7 yellow (14)    | exact      | fig-000629 Baron Von Barron (5948, 1998): monocle                 |
| 22  | lg_       | 3626bp6f yellow (14)    | guess      | red lips and upswept eyelashes                                    |
| 23  | lm_       | 3626bp0c yellow (14)    | guess      | thick moustache and short eyebrows                                |
| 24  | ls_       | 3626bp6u yellow (14)    | guess      | gold paint, fangs and slanted eyes                                |
| 25  | wc_       | 3626bp04 yellow (14)    | guess      | grin and sunglasses                                               |
| 26  | sk_       | 3626bpa8 yellow (14)    | guess      | evil skeleton skull                                               |
| 27  | gs_       | 3626bpao yellow (14)    | guess      | big eyes and orange mouth                                         |
| 28  | rr_       | 3626cp40 yellow (14)    | exact      | fig-011825 Rocket Racer (60298, 2021): eyebrows, goatee and smirk |
| 29  | vv_       | 3626bp09 yellow (14)    | guess      | female, brown eyebrows, pupils and eyelashes                      |

## Torsos

| #   | Game part | LDraw torso (torso / arms / hands)                       | Confidence | Source                                                       |
| --- | --------- | -------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| 0   | tu_chst   | 973p80 (red (4) / red (4) / yellow (14))                 | close      | Racers: red jacket, Octan, TEAM 1 RACING                     |
| 1   | kk_chst   | 973p3h (yellow (14) / yellow (14) / yellow (14))         | exact      | fig-001092 King Kahuka (6236, 1994): bone necklace           |
| 2   | bb_chst   | 973p4i (red (4) / black (0) / yellow (14))               | exact      | fig-000648 Bat Lord, Fright Knights: bat lord tunic          |
| 3   | jt_chst   | 973pa3 (tan (19) / tan (19) / yellow (14))               | exact      | fig-000359 Johnny Thunder (5938, 1998): red bandana, gun     |
| 4   | vb_chst   | 973pa7 (tan (19) / tan (19) / black (0))                 | exact      | fig-000629 Baron Von Barron (5948, 1998): safari shirt       |
| 5   | gm_chst   | 973p58 (black (0) / dark gray (8) / blue (1))            | exact      | fig-000451 Gypsy Moth (3073, 1999): insectoid female         |
| 6   | rk_chst   | 973p4e (red (4) / white (15) / yellow (14))              | close      | Castle: lion head and gold collar on red and white           |
| 7   | nh_chst   | 973p55 (white (15) / light gray (7) / black (0))         | close      | white with a black ring and a yellow arrowhead               |
| 8   | al_chst   | 973p3f (red (4) / red (4) / yellow (14))                 | guess      | red jacket with blue stripes, Pirates                        |
| 9   | rh_chst   | 973pf8 (brown (6) / yellow (14) / yellow (14))           | close      | brown vest with a strap, Castle                              |
| 10  | bj_chst   | 973p39 (blue (1) / blue (1) / yellow (14))               | close      | blue jacket with a brown vest, Pirates                       |
| 11  | cc_chst   | 973p62 (black (0) / white (15) / blue (1))               | guess      | white and black with a blue emblem                           |
| 12  | ap_chst   | plain `973`: game picture, clipped to the torso front    | guess      | no print reads like it: the game picture stays               |
| 13  | tc_chst   | 973pac (yellow (14) / yellow (14) / red (4))             | close      | Islanders: feathers and a medallion on yellow                |
| 14  | sb_chst   | 973p22 (black (0) / dark bluish gray (72) / yellow (14)) | close      | black jacket with a red cravat                               |
| 15  | rr_chst   | plain `973`: game picture, clipped to the torso front    | guess      | the flaming RR is not in the library: the game picture stays |
| 16  | gb_chst   | plain `973`: game picture, clipped to the torso front    | guess      | no print reads like it: the game picture stays               |
| 17  | ad_chst   | plain `973`: game picture, clipped to the torso front    | guess      | no print reads like it: the game picture stays               |
| 18  | il_chst   | 973p3j (yellow (14) / yellow (14) / yellow (14))         | close      | Islanders: green and red leaf collar on yellow               |
| 19  | gs_chst   | plain `973`: game picture, clipped to the torso front    | guess      | no print reads like it: the game picture stays               |
| 20  | ww_chst   | 973p4k (black (0) / dark bluish gray (72) / yellow (14)) | close      | black vest with a red collar and a gold medal                |
| 21  | eo_chst   | 973p1h (red (4) / red (4) / yellow (14))                 | close      | red jacket with white stars                                  |
| 22  | mm_chst   | 973p81 (blue (1) / blue (1) / yellow (14))               | close      | Racers: blue jacket with Octan and OIL                       |
| 23  | in_chst   | 973pz4 (white (15) / white (15) / yellow (14))           | close      | Racers: white jacket with Octan and RACE TEAM                |
| 24  | cr_chst   | 973p36 (black (0) / black (0) / yellow (14))             | close      | Pirates: captain jacket with a green ascot and a strap, hook |
| 25  | bk_chst   | 973pfb (black (0) / dark bluish gray (72) / yellow (14)) | close      | black armour with silver ribs, Castle                        |
| 26  | mj_chst   | 973p46 (blue (1) / blue (1) / yellow (14))               | close      | Forestmen: blue tunic with a tied lace and a purse           |
| 27  | pm_chst   | 973pa2 (black (0) / black (0) / red (4))                 | exact      | fig-000526 Pharaoh Hotep (5988, 1998): breastplate           |
| 28  | vv_chst   | 973p29 (light gray (7) / white (15) / yellow (14))       | guess      | grey vest with a gauge and a pocket                          |

## Legs

| #   | Game part | Hips, left leg, right leg                                                               | Confidence | Source                                                                               |
| --- | --------- | --------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| 0   | leg_blck  | hips black (0), 3817b black (0), 3816b black (0)                                        | close      | black legs                                                                           |
| 1   | leg_bkrd  | hips red (4), 3817b black (0), 3816b black (0)                                          | close      | black legs, red hips                                                                 |
| 2   | leg_bkbl  | hips blue (1), 3817b black (0), 3816b black (0)                                         | close      | black legs, blue hips                                                                |
| 3   | leg_blue  | hips blue (1), 3817b blue (1), 3816b blue (1)                                           | close      | blue legs                                                                            |
| 4   | leg_brwn  | hips brown (6), 3817b brown (6), 3816b brown (6)                                        | close      | brown legs                                                                           |
| 5   | leg_dgbk  | hips black (0), 3817b dark bluish gray (72), 3816b dark bluish gray (72)                | close      | dark grey legs, black hips                                                           |
| 6   | leg_dgbl  | hips blue (1), 3817b dark bluish gray (72), 3816b dark bluish gray (72)                 | close      | dark grey legs, blue hips                                                            |
| 7   | leg_grn   | hips green (2), 3817b green (2), 3816b green (2)                                        | close      | green legs                                                                           |
| 8   | leg_dkgr  | hips dark bluish gray (72), 3817b dark bluish gray (72), 3816b dark bluish gray (72)    | close      | dark grey legs                                                                       |
| 9   | leg_ltgr  | hips light bluish gray (71), 3817b light bluish gray (71), 3816b light bluish gray (71) | close      | light grey legs                                                                      |
| 10  | leg_peg   | hips brown (6), 3817b black (0), 2532 brown (6)                                         | close      | black left leg, wooden peg right leg, brown hips (Pirates)                           |
| 11  | leg_red   | hips red (4), 3817b red (4), 3816b red (4)                                              | close      | red legs                                                                             |
| 12  | leg_wht   | hips white (15), 3817b white (15), 3816b white (15)                                     | close      | white legs                                                                           |
| 13  | tc_leg    | hips green (2), 3817cp3j yellow (14), 3816cp3j yellow (14)                              | close      | Islanders: green leaf print on yellow legs (fig-001092 King Kahuka)                  |
| 14  | pm_leg    | hips green (2), 3817cpa2 black (0), 3816cpa2 black (0)                                  | exact      | fig-000526 Pharaoh Hotep (5988, 1998): green kilt and toes on black legs, green hips |
| 15  | ad_leg    | hips white (15), 3817b white (15), 3816b white (15)                                     | close      | white legs (no robot print matches)                                                  |
| 16  | ap_leg    | hips dark bluish gray (72), 3817b dark bluish gray (72), 3816b dark bluish gray (72)    | close      | dark grey legs                                                                       |
| 17  | kk_leg    | hips green (2), 3817cp3j yellow (14), 3816cp3j yellow (14)                              | exact      | fig-001092 King Kahuka (6236, 1994): green leaf print on yellow legs, green hips     |
| 18  | rr_leg    | hips light bluish gray (71), 3817b light bluish gray (71), 3816b light bluish gray (71) | close      | light grey legs                                                                      |
| 19  | vv_leg    | hips light bluish gray (71), 3817b light bluish gray (71), 3816b light bluish gray (71) | close      | light grey legs                                                                      |

## Renders

The sheets are in `~/ldraw-gallery/drivers/` (`champion-<DRIVER>.png`, `all-drivers-*.png`, `catalogue-hats|faces|torsos|legs.png`), made by `/ldraw-racer-gallery.html` on the dev server (see [remastered-ldraw-racers.md](remastered-ldraw-racers.md)).
