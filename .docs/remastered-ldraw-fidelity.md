# LDraw fidelity scores

Written by `pnpm run ldraw-fidelity`; do not edit. How it measures and how to use it: [remastered.md](remastered.md#judging-ldraw-work). A replacement passes at a score of 80 or more. 40 of 705 items pass. Every item, with each view and attachment point, is in `reverse-engineering/ldraw-fidelity/fidelity.json` (not committed).

## By kind

| Kind      | Items | Passed | Mean score | Worst                   |
| --------- | ----- | ------ | ---------- | ----------------------- |
| brick     | 66    | 23     | 75.2       | L239901 (12.5)          |
| composite | 24    | 1      | 48.3       | sprtswd2 (12.8)         |
| chassis   | 12    | 0      | 9.8        | bbchas0 (0.0)           |
| pickup    | 2     | 1      | 80.8       | PUBRICKY (77.8)         |
| car       | 21    | 0      | 52.5       | GBCM (draft) (32.1)     |
| wheels    | 24    | 15     | 76.7       | dachas0 (33.3)          |
| driver    | 96    | 0      | 38.8       | TC steering (11.4)      |
| hat       | 144   | 0      | 39.3       | tc_hats seated (10.7)   |
| face      | 120   | 0      | 44.1       | lh_ steering (35.4)     |
| torso     | 116   | 0      | 45.9       | kk_chst steering (38.0) |
| legs      | 80    | 0      | 41.7       | tc_leg steering (37.4)  |

## The 100 worst

IoU: silhouette overlap, the mean of the four views (the worst view). Offset: the centre of area of the replacement from the original, LDraw units, x forward, y left, z up. Scale: the size of the bounds, replacement over original. ΔE: the mean CIE76 colour difference where both cover. Anchors: attachment points, LDraw units.

| Score | Result | Item                  | IoU           | Offset x / y / z    | Scale | ΔE   | Anchors                                                              | Note            |
| ----- | ------ | --------------------- | ------------- | ------------------- | ----- | ---- | -------------------------------------------------------------------- | --------------- |
| 0.0   | fail   | `chassis:bbchas0`     | 0.334 (0.143) | -46.7 / -1.9 / -1.0 | 0.428 | 30.2 | brick grid 17.0                                                      |                 |
| 0.3   | fail   | `chassis:crchas0`     | 0.451 (0.162) | 8.5 / -0.8 / -15.3  | 0.586 | 29.6 | brick grid 14.0                                                      |                 |
| 0.8   | fail   | `chassis:gm_chas0`    | 0.377 (0.305) | -15.4 / 1.0 / 8.5   | 0.575 | 54.6 | brick grid 9.2                                                       |                 |
| 2.0   | fail   | `chassis:rrchas0`     | 0.372 (0.265) | -24.9 / -0.3 / 7.7  | 0.613 | 45.0 | brick grid 8.0                                                       |                 |
| 4.4   | fail   | `chassis:jtchas0`     | 0.411 (0.217) | -8.2 / -0.1 / 2.1   | 0.613 | 35.4 | brick grid 8.0                                                       |                 |
| 9.3   | fail   | `chassis:dbchas0`     | 0.389 (0.140) | -14.3 / -0.7 / 6.3  | 0.697 | 16.1 | brick grid 9.0                                                       |                 |
| 10.7  | fail   | `hat:10:seated`       | 0.581 (0.443) | -6.0 / 0.2 / 6.5    | 1.319 | 52.4 | head 14.7, head top 15.1, left hand 21.9, right hand 22.4, seat 2.1  |                 |
| 10.8  | fail   | `hat:10:steering`     | 0.580 (0.428) | -5.8 / 1.2 / 6.4    | 1.343 | 51.6 | head 15.5, head top 15.9, left hand 21.6, right hand 22.9, seat 3.5  |                 |
| 11.4  | fail   | `driver:TC:steering`  | 0.516 (0.349) | -4.8 / 0.8 / 0.7    | 1.234 | 52.6 | head 14.6, head top 17.1, left hand 21.6, right hand 22.9, seat 15.3 |                 |
| 12.2  | fail   | `chassis:bvbcha0`     | 0.417 (0.176) | -0.4 / -0.4 / -12.9 | 0.603 | 16.4 | brick grid 6.0                                                       |                 |
| 12.2  | fail   | `driver:TC:seated`    | 0.520 (0.364) | -5.1 / -0.3 / 0.6   | 1.213 | 52.5 | head 13.9, head top 16.5, left hand 21.9, right hand 22.4, seat 12.8 |                 |
| 12.4  | fail   | `chassis:ddchas0`     | 0.400 (0.147) | -14.0 / 0.6 / 11.7  | 0.761 | 9.3  | brick grid 24.7                                                      |                 |
| 12.5  | fail   | `brick:L239901`       | 0.433 (0.177) | 31.9 / 3.1 / -0.2   | 1.679 | 11.3 |                                                                      |                 |
| 12.5  | fail   | `brick:L239902`       | 0.468 (0.255) | 28.9 / 4.1 / -0.1   | 1.679 | 11.3 |                                                                      |                 |
| 12.8  | fail   | `composite:sprtswd2`  | 0.484 (0.367) | -5.5 / 4.5 / 2.7    | 0.945 | 39.4 |                                                                      |                 |
| 15.0  | fail   | `hat:10:standing`     | 0.590 (0.446) | -8.1 / -0.6 / 3.1   | 1.202 | 61.4 | head 18.2, head top 14.7, left hand 17.6, right hand 14.3, seat 3.2  |                 |
| 15.5  | fail   | `chassis:dcchas0`     | 0.581 (0.419) | 8.2 / -0.1 / 3.4    | 0.786 | 39.2 | brick grid 6.1                                                       |                 |
| 17.0  | fail   | `chassis:dachas0`     | 0.528 (0.466) | -1.8 / 0.3 / -10.4  | 0.678 | 9.3  | brick grid 8.5                                                       |                 |
| 17.7  | fail   | `driver:PH:steering`  | 0.553 (0.399) | 1.1 / 1.6 / 3.1     | 1.227 | 48.0 | head 5.7, head top 14.0, left hand 21.6, right hand 22.9, seat 15.3  |                 |
| 18.3  | fail   | `hat:10:menu_idle`    | 0.600 (0.477) | -6.9 / 3.5 / 1.9    | 1.167 | 58.1 | head 20.1, head top 14.4, left hand 9.8, right hand 13.8, seat 3.7   |                 |
| 18.4  | fail   | `hat:26:steering`     | 0.640 (0.499) | 0.4 / 2.0 / 7.9     | 1.355 | 48.9 | head 2.9, head top 10.0, left hand 21.6, right hand 22.9, seat 3.5   |                 |
| 19.3  | fail   | `driver:TC:menu_idle` | 0.619 (0.488) | -6.6 / 3.1 / 5.3    | 1.156 | 55.2 | head 20.1, head top 14.4, left hand 9.8, right hand 13.8, seat 3.1   |                 |
| 19.3  | fail   | `hat:7:steering`      | 0.638 (0.484) | 1.8 / 2.2 / 7.8     | 1.252 | 46.4 | head 4.6, head top 7.1, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 19.5  | fail   | `driver:TC:standing`  | 0.607 (0.449) | -7.3 / -0.6 / 6.3   | 1.078 | 54.0 | head 18.2, head top 14.7, left hand 17.6, right hand 14.3, seat 2.7  |                 |
| 19.5  | fail   | `hat:26:seated`       | 0.647 (0.506) | 0.3 / 0.1 / 7.9     | 1.371 | 48.0 | head 1.9, head top 9.4, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 19.5  | fail   | `hat:7:seated`        | 0.639 (0.477) | 1.8 / 0.2 / 7.9     | 1.258 | 47.1 | head 2.4, head top 4.5, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 20.1  | fail   | `driver:PH:seated`    | 0.566 (0.415) | 1.1 / -0.1 / 3.2    | 1.209 | 47.7 | head 4.3, head top 13.5, left hand 21.9, right hand 22.4, seat 12.8  |                 |
| 20.2  | fail   | `chassis:kkchas0`     | 0.518 (0.329) | -1.4 / -0.4 / -2.1  | 0.650 | 60.7 | brick grid 3.0                                                       |                 |
| 20.9  | fail   | `composite:sprtswd`   | 0.556 (0.355) | 5.2 / 5.1 / 1.1     | 1.038 | 37.2 |                                                                      |                 |
| 21.3  | fail   | `driver:KK:steering`  | 0.650 (0.518) | 1.5 / 2.4 / 9.1     | 1.172 | 42.4 | head 5.8, head top 9.8, left hand 21.6, right hand 22.9, seat 2.8    |                 |
| 22.1  | fail   | `hat:31:steering`     | 0.613 (0.516) | 1.4 / 2.0 / 4.5     | 1.224 | 47.3 | head 4.9, head top 7.4, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 22.5  | fail   | `hat:31:seated`       | 0.606 (0.507) | 0.9 / 0.1 / 4.3     | 1.224 | 48.3 | head 5.0, head top 7.0, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 22.6  | fail   | `driver:KK:seated`    | 0.666 (0.523) | 1.3 / 0.2 / 10.1    | 1.164 | 42.6 | head 3.0, head top 6.7, left hand 21.9, right hand 22.4, seat 2.4    |                 |
| 22.9  | fail   | `chassis:vvchas0`     | 0.518 (0.279) | 2.7 / -1.5 / 0.7    | 0.699 | 18.9 | brick grid 6.0                                                       |                 |
| 23.2  | fail   | `driver:CC:steering`  | 0.581 (0.440) | 3.6 / 1.8 / -1.3    | 1.123 | 50.5 | head 7.2, head top 8.1, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 23.3  | fail   | `driver:AD:steering`  | 0.575 (0.435) | 1.8 / 1.2 / 0.2     | 1.190 | 44.2 | head 7.0, head top 9.5, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 23.5  | fail   | `driver:IL:steering`  | 0.593 (0.444) | 3.8 / 0.6 / -5.2    | 1.059 | 45.5 | head 6.5, head top 7.3, left hand 21.6, right hand 22.9, seat 15.3   |                 |
| 25.0  | fail   | `driver:AD:seated`    | 0.576 (0.444) | 1.4 / -0.2 / 0.2    | 1.180 | 44.0 | head 7.1, head top 9.1, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 25.0  | fail   | `driver:BH:steering`  | 0.584 (0.429) | 2.7 / 1.1 / -0.1    | 1.140 | 43.2 | head 7.0, head top 9.6, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 25.0  | fail   | `driver:IL:seated`    | 0.596 (0.430) | 3.5 / 0.2 / -3.7    | 1.081 | 45.6 | head 8.1, head top 9.9, left hand 21.9, right hand 22.4, seat 12.8   |                 |
| 25.0  | fail   | `driver:RK:steering`  | 0.591 (0.470) | 2.2 / 1.1 / -2.9    | 1.125 | 58.9 | head 3.0, head top 3.3, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 25.2  | fail   | `hat:19:menu_idle`    | 0.636 (0.597) | 1.0 / 3.3 / 1.8     | 0.700 | 44.2 | head 8.7, head top 9.1, left hand 9.8, right hand 13.8, seat 3.7     |                 |
| 25.2  | fail   | `hat:34:steering`     | 0.638 (0.539) | 1.5 / 1.6 / 5.6     | 1.175 | 38.9 | head 5.5, head top 8.6, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 25.4  | fail   | `hat:27:steering`     | 0.630 (0.518) | 1.5 / 1.8 / 6.4     | 1.106 | 36.3 | head 4.9, head top 7.4, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 25.6  | fail   | `driver:RH:steering`  | 0.594 (0.460) | 1.9 / 0.4 / -0.6    | 1.198 | 35.2 | head 6.3, head top 9.2, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 25.8  | fail   | `hat:34:seated`       | 0.639 (0.552) | 1.1 / -0.4 / 5.4    | 1.179 | 39.5 | head 5.8, head top 8.4, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 26.1  | fail   | `driver:RH:seated`    | 0.598 (0.483) | 1.4 / -0.8 / -0.7   | 1.208 | 34.3 | head 7.2, head top 9.4, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 26.2  | fail   | `driver:AL:steering`  | 0.588 (0.514) | 1.3 / 1.1 / -2.0    | 1.128 | 38.8 | head 3.9, head top 3.4, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 26.3  | fail   | `driver:BH:seated`    | 0.591 (0.451) | 2.5 / -0.3 / 0.0    | 1.139 | 43.8 | head 7.3, head top 9.6, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 26.4  | fail   | `hat:19:standing`     | 0.632 (0.549) | 1.9 / 1.2 / 1.4     | 0.679 | 47.3 | head 5.3, head top 5.8, left hand 17.6, right hand 14.3, seat 3.2    |                 |
| 26.5  | fail   | `driver:AP:seated`    | 0.629 (0.479) | 4.7 / 0.3 / -4.4    | 1.088 | 33.5 | head 6.7, head top 8.1, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 26.5  | fail   | `hat:27:seated`       | 0.629 (0.524) | 1.2 / -0.1 / 6.3    | 1.087 | 37.7 | head 4.9, head top 7.2, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 26.6  | fail   | `driver:AP:steering`  | 0.632 (0.478) | 4.8 / 1.0 / -4.5    | 1.084 | 33.1 | head 6.5, head top 7.5, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 26.7  | fail   | `driver:CC:seated`    | 0.596 (0.457) | 3.5 / 0.1 / -1.4    | 1.089 | 50.8 | head 6.5, head top 7.5, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 26.9  | fail   | `driver:RK:seated`    | 0.606 (0.489) | 2.1 / -0.1 / -3.0   | 1.123 | 58.4 | head 2.5, head top 1.9, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 27.0  | fail   | `driver:GS:steering`  | 0.609 (0.490) | 2.0 / 0.8 / -2.6    | 1.142 | 36.4 | head 5.4, head top 6.4, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 27.7  | fail   | `hat:19:steering`     | 0.626 (0.531) | 3.9 / 1.0 / -1.0    | 0.875 | 43.8 | head 4.9, head top 5.7, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 27.8  | fail   | `hat:12:steering`     | 0.638 (0.521) | 4.0 / 2.7 / 3.9     | 1.090 | 58.1 | head 6.0, head top 6.7, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 28.0  | fail   | `brick:S00016`        | 0.607 (0.326) | 6.1 / 0.2 / 2.0     | 1.057 | 88.9 |                                                                      |                 |
| 28.0  | fail   | `driver:AL:seated`    | 0.603 (0.545) | 1.2 / -0.5 / -2.3   | 1.127 | 39.4 | head 4.6, head top 4.3, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 28.0  | fail   | `hat:19:seated`       | 0.623 (0.472) | 3.9 / 0.1 / 0.1     | 0.879 | 45.1 | head 6.5, head top 8.3, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 28.5  | fail   | `driver:GS:seated`    | 0.616 (0.509) | 1.6 / -0.3 / -2.6   | 1.136 | 35.9 | head 5.6, head top 6.3, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 28.6  | fail   | `driver:GB:steering`  | 0.633 (0.484) | 3.6 / 0.9 / -3.5    | 1.098 | 51.5 | head 4.9, head top 4.8, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 28.7  | fail   | `hat:32:seated`       | 0.643 (0.556) | 2.4 / 0.1 / 3.5     | 1.166 | 51.6 | head 5.0, head top 7.3, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 28.8  | fail   | `hat:15:seated`       | 0.646 (0.529) | 3.8 / 0.2 / 4.0     | 1.116 | 38.3 | head 7.2, head top 8.6, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 28.8  | fail   | `hat:15:steering`     | 0.648 (0.532) | 3.9 / 2.1 / 4.0     | 1.102 | 36.9 | head 6.7, head top 8.8, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 28.8  | fail   | `hat:16:seated`       | 0.646 (0.529) | 3.8 / 0.2 / 4.0     | 1.116 | 40.5 | head 7.2, head top 8.6, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 28.8  | fail   | `hat:16:steering`     | 0.648 (0.532) | 3.9 / 2.1 / 4.0     | 1.102 | 38.5 | head 6.7, head top 8.8, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 28.8  | fail   | `hat:17:seated`       | 0.646 (0.529) | 3.8 / 0.2 / 4.0     | 1.116 | 39.8 | head 7.2, head top 8.6, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 28.8  | fail   | `hat:17:steering`     | 0.648 (0.532) | 3.9 / 2.1 / 4.0     | 1.102 | 37.9 | head 6.7, head top 8.8, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 29.3  | fail   | `driver:NH:steering`  | 0.649 (0.515) | 2.8 / 0.6 / -3.6    | 1.150 | 35.6 | head 5.5, head top 7.0, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 29.6  | fail   | `hat:32:steering`     | 0.651 (0.538) | 2.3 / 1.9 / 3.9     | 1.135 | 49.9 | head 5.2, head top 7.6, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 29.7  | fail   | `driver:SB:steering`  | 0.616 (0.494) | 2.1 / 0.9 / -2.5    | 1.142 | 26.8 | head 6.1, head top 8.0, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 30.2  | fail   | `driver:GB:seated`    | 0.638 (0.496) | 3.5 / 0.2 / -3.4    | 1.074 | 51.6 | head 5.2, head top 4.8, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 30.2  | fail   | `hat:25:menu_idle`    | 0.689 (0.642) | 0.8 / 2.9 / -3.3    | 0.789 | 30.7 | head 12.5, head top 22.4, left hand 9.8, right hand 13.8, seat 3.7   |                 |
| 30.3  | fail   | `hat:12:seated`       | 0.636 (0.514) | 4.5 / 0.3 / 2.7     | 1.052 | 60.7 | head 5.6, head top 6.3, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 30.5  | fail   | `driver:NH:seated`    | 0.652 (0.503) | 2.3 / -0.1 / -3.5   | 1.143 | 35.7 | head 5.3, head top 6.8, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 30.6  | fail   | `driver:BK:steering`  | 0.619 (0.509) | 2.9 / 0.9 / -2.8    | 1.071 | 28.1 | head 2.6, head top 5.8, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 31.0  | fail   | `driver:SB:seated`    | 0.625 (0.513) | 1.9 / -0.3 / -2.5   | 1.132 | 27.4 | head 5.9, head top 7.0, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 31.2  | fail   | `composite:sFlag`     | 0.674 (0.627) | 9.9 / 0.4 / 1.1     | 1.034 | 45.8 |                                                                      |                 |
| 31.7  | fail   | `hat:3:steering`      | 0.675 (0.545) | 1.9 / 2.0 / 5.1     | 1.113 | 35.2 | head 6.5, head top 6.9, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 31.9  | fail   | `brick:l347500`       | 0.565 (0.329) | 8.4 / 0.3 / -3.7    | 0.973 | 11.3 |                                                                      |                 |
| 31.9  | fail   | `driver:BK:seated`    | 0.631 (0.531) | 2.8 / -0.3 / -2.8   | 1.069 | 28.6 | head 1.0, head top 6.2, left hand 21.9, right hand 22.4, seat 14.0   |                 |
| 32.1  | fail   | `car:drafts/GBCM`     | 0.693 (0.587) | -6.0 / -0.2 / 12.3  | 1.275 | 35.8 | wheel 1 0.0, wheel 2 0.0, wheel 3 0.0, wheel 4 0.0                   | drafts/GBCM.ldr |
| 32.1  | fail   | `hat:13:steering`     | 0.665 (0.550) | 2.8 / 1.4 / 4.1     | 0.911 | 35.8 | head 4.8, head top 6.8, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 32.6  | fail   | `hat:13:seated`       | 0.665 (0.582) | 2.8 / 0.7 / 4.1     | 0.919 | 35.8 | head 4.8, head top 6.8, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 32.7  | fail   | `hat:11:seated`       | 0.682 (0.525) | 4.0 / 0.7 / 2.8     | 0.873 | 45.6 | head 4.8, head top 6.2, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 32.9  | fail   | `hat:25:standing`     | 0.715 (0.654) | 1.6 / 0.8 / -3.5    | 0.762 | 31.6 | head 10.8, head top 21.8, left hand 17.6, right hand 14.3, seat 3.2  |                 |
| 33.1  | fail   | `driver:IL:standing`  | 0.664 (0.563) | 1.6 / 1.4 / 3.7     | 0.885 | 38.7 | head 5.3, head top 5.8, left hand 17.6, right hand 14.3, seat 2.7    |                 |
| 33.2  | fail   | `hat:23:steering`     | 0.627 (0.539) | 1.8 / 1.9 / 1.7     | 1.033 | 43.2 | head 3.1, head top 5.7, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 33.3  | fail   | `wheels:dachas0`      | 0.371 (0.118) | 0.0 / 0.0 / -0.0    | 1.072 | 24.9 | wheel 1 2.0, wheel 2 2.0, wheel 3 2.0, wheel 4 2.0                   |                 |
| 33.5  | fail   | `hat:3:seated`        | 0.688 (0.575) | 1.6 / 0.3 / 5.0     | 1.124 | 36.2 | head 6.5, head top 7.3, left hand 21.9, right hand 22.4, seat 2.1    |                 |
| 33.7  | fail   | `hat:6:steering`      | 0.670 (0.561) | 2.7 / 1.7 / 4.3     | 1.058 | 34.1 | head 5.6, head top 6.7, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 33.7  | fail   | `hat:8:steering`      | 0.661 (0.604) | 1.8 / 1.8 / 2.6     | 1.105 | 32.4 | head 4.2, head top 6.1, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 33.8  | fail   | `driver:WW:steering`  | 0.629 (0.483) | 1.6 / 0.4 / -2.3    | 1.116 | 25.2 | head 6.9, head top 9.3, left hand 21.6, right hand 22.9, seat 16.6   |                 |
| 34.0  | fail   | `hat:24:steering`     | 0.666 (0.611) | 1.0 / 1.8 / 3.4     | 1.097 | 35.3 | head 2.2, head top 2.0, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 34.2  | fail   | `car:drafts/ACM`      | 0.703 (0.577) | -5.5 / -0.0 / 10.8  | 1.244 | 42.5 | wheel 1 0.0, wheel 2 0.0, wheel 3 0.0, wheel 4 0.0                   | drafts/ACM.ldr  |
| 34.3  | fail   | `hat:11:steering`     | 0.701 (0.559) | 4.2 / 1.9 / 2.7     | 0.877 | 45.1 | head 4.6, head top 5.6, left hand 21.6, right hand 22.9, seat 3.5    |                 |
| 34.4  | fail   | `hat:6:seated`        | 0.669 (0.554) | 2.2 / -0.0 / 4.3    | 1.058 | 35.3 | head 9.0, head top 10.5, left hand 21.9, right hand 22.4, seat 2.1   |                 |
| 34.7  | fail   | `driver:WW:seated`    | 0.627 (0.507) | 1.1 / -0.4 / -2.3   | 1.091 | 25.5 | head 7.0, head top 8.7, left hand 21.9, right hand 22.4, seat 14.0   |                 |
