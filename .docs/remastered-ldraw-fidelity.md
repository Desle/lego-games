# LDraw fidelity scores

Written by `pnpm run ldraw-fidelity`; do not edit. How it measures and how to use it: [remastered.md](remastered.md#judging-ldraw-work). A replacement passes at a score of 80 or more. 0 of 319 items pass. Every item, with each view and attachment point, is in `reverse-engineering/ldraw-fidelity/fidelity.json` (not committed).

## By kind

| Kind   | Items | Passed | Mean score | Worst                     |
| ------ | ----- | ------ | ---------- | ------------------------- |
| driver | 96    | 0      | 52.4       | PH seated (34.3)          |
| hat    | 144   | 0      | 52.7       | il_hairs menu_idle (32.3) |
| face   | 30    | 0      | 64.5       | sk_ standing (63.7)       |
| torso  | 29    | 0      | 62.3       | bj_chst standing (58.4)   |
| legs   | 20    | 0      | 55.4       | leg_blue standing (51.2)  |

## The 100 worst

IoU: silhouette overlap, the mean of the four views (the worst view). Offset: the centre of area of the replacement from the original, LDraw units, x forward, y left, z up. Scale: the size of the bounds, replacement over original. ΔE: the mean CIE76 colour difference where both cover. Anchors: attachment points, LDraw units.

| Score | Result | Item                  | IoU           | Offset x / y / z  | Scale | ΔE   | Anchors                                                            | Note |
| ----- | ------ | --------------------- | ------------- | ----------------- | ----- | ---- | ------------------------------------------------------------------ | ---- |
| 32.3  | fail   | `hat:19:menu_idle`    | 0.698 (0.652) | -0.6 / 3.6 / 3.8  | 0.780 | 33.7 | head 8.4, head top 8.4, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 33.8  | fail   | `hat:25:menu_idle`    | 0.691 (0.656) | -1.4 / 3.4 / -1.8 | 0.837 | 29.8 | head 10.6, head top 17.9, left hand 8.7, right hand 7.3, seat 3.7  |      |
| 34.3  | fail   | `driver:PH:seated`    | 0.685 (0.640) | -1.2 / -0.5 / 6.0 | 1.149 | 42.2 | head 3.5, head top 5.9, left hand 8.7, right hand 9.2              |      |
| 35.1  | fail   | `driver:PH:steering`  | 0.695 (0.664) | -1.0 / 2.0 / 5.7  | 1.156 | 42.7 | head 3.4, head top 6.6, left hand 8.9, right hand 8.7              |      |
| 35.7  | fail   | `hat:19:standing`     | 0.710 (0.683) | -0.3 / 1.2 / 4.1  | 0.767 | 28.2 | head 5.6, head top 5.6, left hand 10.7, right hand 11.4, seat 3.2  |      |
| 36.1  | fail   | `hat:7:steering`      | 0.716 (0.661) | 2.0 / 2.2 / 2.9   | 1.252 | 38.7 | head 7.6, head top 4.9, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 36.8  | fail   | `hat:7:seated`        | 0.715 (0.644) | 2.0 / 0.0 / 3.3   | 1.258 | 37.6 | head 7.4, head top 4.5, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 37.5  | fail   | `hat:33:menu_idle`    | 0.701 (0.661) | -2.6 / 4.1 / -3.1 | 0.913 | 41.5 | head 8.3, head top 9.9, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 37.9  | fail   | `hat:7:menu_idle`     | 0.694 (0.665) | -2.3 / 3.5 / 3.0  | 1.110 | 40.0 | head 7.3, head top 7.2, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 38.1  | fail   | `driver:KK:steering`  | 0.692 (0.620) | 1.7 / 2.1 / 0.9   | 1.186 | 36.9 | head 5.8, head top 4.5, left hand 8.9, right hand 8.7, seat 9.4    |      |
| 39.3  | fail   | `hat:13:menu_idle`    | 0.729 (0.627) | -0.5 / 4.6 / -2.3 | 0.831 | 31.5 | head 5.9, head top 5.9, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 39.8  | fail   | `hat:18:menu_idle`    | 0.701 (0.661) | -2.6 / 4.1 / -3.1 | 0.913 | 26.2 | head 8.3, head top 9.9, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 40.2  | fail   | `driver:KK:menu_idle` | 0.717 (0.672) | -2.1 / 2.9 / 5.6  | 1.058 | 35.1 | head 7.3, head top 7.2, left hand 8.7, right hand 7.3, seat 3.1    |      |
| 40.4  | fail   | `driver:KK:seated`    | 0.694 (0.604) | 1.6 / 0.1 / 1.8   | 1.179 | 36.3 | head 5.1, head top 1.7, left hand 8.7, right hand 9.2, seat 6.9    |      |
| 40.7  | fail   | `hat:26:steering`     | 0.758 (0.694) | 0.7 / 1.8 / 2.8   | 1.355 | 41.9 | head 7.5, head top 3.5, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 41.1  | fail   | `driver:IL:standing`  | 0.738 (0.695) | -0.1 / 0.7 / 5.5  | 0.873 | 29.4 | head 5.6, head top 5.6, left hand 10.7, right hand 11.4, seat 2.7  |      |
| 41.1  | fail   | `hat:26:seated`       | 0.755 (0.668) | 0.5 / -0.1 / 3.2  | 1.371 | 40.6 | head 8.0, head top 2.5, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 42.4  | fail   | `hat:10:menu_idle`    | 0.724 (0.679) | -1.5 / 3.3 / -0.8 | 0.862 | 55.5 | head 5.2, head top 5.9, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 42.8  | fail   | `hat:7:standing`      | 0.724 (0.716) | -1.8 / 1.1 / 3.8  | 1.103 | 35.1 | head 4.5, head top 4.5, left hand 10.7, right hand 11.4, seat 3.2  |      |
| 43.1  | fail   | `driver:KK:standing`  | 0.738 (0.725) | -1.2 / 0.6 / 6.8  | 0.972 | 32.8 | head 4.5, head top 4.5, left hand 10.7, right hand 11.4, seat 2.7  |      |
| 43.3  | fail   | `hat:26:menu_idle`    | 0.749 (0.691) | -2.5 / 2.8 / 1.6  | 1.198 | 43.9 | head 6.0, head top 6.1, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 43.4  | fail   | `hat:33:standing`     | 0.738 (0.658) | -2.7 / 1.1 / -2.0 | 0.901 | 33.8 | head 7.5, head top 11.0, left hand 10.7, right hand 11.4, seat 3.2 |      |
| 43.5  | fail   | `driver:GM:steering`  | 0.756 (0.708) | 2.8 / 0.8 / -5.5  | 1.100 | 35.3 | head 3.6, head top 3.4, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 43.8  | fail   | `hat:25:standing`     | 0.730 (0.682) | -0.9 / 0.8 / -1.5 | 0.810 | 23.2 | head 8.2, head top 16.0, left hand 10.7, right hand 11.4, seat 3.2 |      |
| 44.3  | fail   | `hat:23:steering`     | 0.725 (0.671) | 1.3 / 1.7 / 0.0   | 1.096 | 37.2 | head 7.9, head top 8.8, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 44.5  | fail   | `driver:IL:menu_idle` | 0.741 (0.718) | -0.4 / 3.1 / 4.6  | 0.956 | 32.2 | head 8.4, head top 8.4, left hand 8.7, right hand 7.3, seat 3.1    |      |
| 44.8  | fail   | `driver:BB:steering`  | 0.748 (0.709) | 2.4 / 1.4 / -4.1  | 1.117 | 28.1 | head 4.0, head top 3.8, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 45.0  | fail   | `driver:RK:seated`    | 0.713 (0.634) | -0.5 / -0.4 / 2.6 | 1.073 | 47.0 | head 3.9, head top 6.0, left hand 8.7, right hand 9.2              |      |
| 45.1  | fail   | `hat:23:seated`       | 0.706 (0.634) | 1.6 / 0.1 / -0.3  | 1.052 | 35.2 | head 7.1, head top 9.1, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 45.2  | fail   | `driver:RK:steering`  | 0.722 (0.647) | -0.4 / 1.8 / 2.5  | 1.075 | 49.3 | head 4.8, head top 5.9, left hand 8.9, right hand 8.7              |      |
| 45.2  | fail   | `hat:23:menu_idle`    | 0.744 (0.722) | -2.0 / 3.5 / -0.3 | 0.911 | 62.1 | head 6.5, head top 10.4, left hand 8.7, right hand 7.3, seat 3.7   |      |
| 45.6  | fail   | `driver:PH:standing`  | 0.759 (0.703) | -1.4 / -0.3 / 5.7 | 0.935 | 35.6 | head 2.4, head top 6.2, left hand 10.7, right hand 11.4, seat 2.7  |      |
| 45.9  | fail   | `hat:14:menu_idle`    | 0.740 (0.722) | -2.0 / 3.1 / -1.7 | 0.920 | 39.5 | head 5.8, head top 6.7, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 46.1  | fail   | `driver:RR:steering`  | 0.773 (0.716) | 3.3 / 0.9 / -4.2  | 1.095 | 30.9 | head 5.0, head top 4.8, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 46.1  | fail   | `driver:VV:steering`  | 0.772 (0.716) | 3.3 / 0.9 / -4.2  | 1.095 | 33.6 | head 5.0, head top 4.8, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 46.2  | fail   | `hat:26:standing`     | 0.755 (0.690) | -1.9 / -0.0 / 2.9 | 1.146 | 37.4 | head 2.4, head top 6.2, left hand 10.7, right hand 11.4, seat 3.2  |      |
| 46.5  | fail   | `driver:CR:steering`  | 0.756 (0.724) | 2.4 / 1.2 / -3.8  | 1.096 | 29.4 | head 4.2, head top 4.1, left hand 7.2, right hand 8.7, seat 10.6   |      |
| 46.7  | fail   | `hat:12:menu_idle`    | 0.734 (0.688) | -1.7 / 3.3 / -2.2 | 0.966 | 51.2 | head 5.5, head top 7.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 46.8  | fail   | `driver:BVB:steering` | 0.760 (0.725) | 1.7 / 0.8 / -3.9  | 1.123 | 35.8 | head 2.9, head top 2.1, left hand 7.2, right hand 8.7, seat 10.6   |      |
| 47.2  | fail   | `driver:GM:seated`    | 0.768 (0.715) | 2.4 / -0.2 / -4.5 | 1.092 | 34.6 | head 3.2, head top 3.6, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 47.2  | fail   | `hat:10:steering`     | 0.734 (0.725) | 2.5 / 1.2 / -1.5  | 0.967 | 50.5 | head 5.6, head top 4.9, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 47.4  | fail   | `hat:34:menu_idle`    | 0.736 (0.692) | -2.0 / 3.1 / 0.3  | 1.051 | 38.0 | head 6.0, head top 6.1, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 47.5  | fail   | `hat:0:menu_idle`     | 0.749 (0.705) | -1.7 / 2.3 / -1.9 | 0.903 | 39.1 | head 4.9, head top 5.8, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 47.6  | fail   | `hat:13:standing`     | 0.753 (0.646) | -1.1 / 1.5 / -2.1 | 0.827 | 25.6 | head 4.1, head top 3.9, left hand 10.7, right hand 11.4, seat 3.2  |      |
| 47.7  | fail   | `driver:PH:menu_idle` | 0.759 (0.701) | -2.3 / 2.4 / 4.7  | 1.035 | 37.9 | head 6.0, head top 6.1, left hand 8.7, right hand 7.3, seat 3.1    |      |
| 47.7  | fail   | `hat:19:steering`     | 0.740 (0.653) | 2.9 / 1.2 / -1.8  | 0.946 | 28.0 | head 5.3, head top 4.1, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 47.8  | fail   | `driver:IL:seated`    | 0.729 (0.657) | 0.8 / -0.2 / 2.0  | 1.072 | 32.4 | head 4.0, head top 5.0, left hand 8.7, right hand 9.2              |      |
| 47.8  | fail   | `hat:24:menu_idle`    | 0.745 (0.727) | -1.2 / 3.3 / -2.5 | 0.938 | 27.7 | head 5.6, head top 9.4, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 48.1  | fail   | `driver:RH:seated`    | 0.753 (0.667) | -1.0 / -1.2 / 3.2 | 1.154 | 26.1 | head 4.3, head top 4.0, left hand 8.7, right hand 9.2              |      |
| 48.3  | fail   | `driver:RR:seated`    | 0.778 (0.723) | 3.2 / -0.2 / -3.8 | 1.088 | 30.0 | head 4.5, head top 4.2, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 48.3  | fail   | `driver:VV:seated`    | 0.778 (0.723) | 3.2 / -0.2 / -3.8 | 1.088 | 33.1 | head 4.5, head top 4.2, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 48.4  | fail   | `hat:10:seated`       | 0.735 (0.713) | 2.2 / -0.6 / -1.8 | 0.958 | 49.1 | head 4.3, head top 3.3, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 48.6  | fail   | `driver:BB:seated`    | 0.754 (0.711) | 2.0 / -0.1 / -3.3 | 1.122 | 27.4 | head 2.1, head top 2.0, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 48.7  | fail   | `hat:31:menu_idle`    | 0.741 (0.704) | -2.5 / 2.8 / 0.4  | 1.036 | 46.5 | head 5.2, head top 5.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 48.8  | fail   | `hat:9:menu_idle`     | 0.746 (0.720) | -2.2 / 3.5 / -1.2 | 0.971 | 33.7 | head 4.7, head top 5.2, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 49.1  | fail   | `hat:15:menu_idle`    | 0.748 (0.701) | -2.4 / 3.3 / -0.2 | 1.031 | 30.9 | head 6.0, head top 5.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 49.1  | fail   | `hat:16:menu_idle`    | 0.748 (0.701) | -2.4 / 3.3 / -0.2 | 1.031 | 32.7 | head 6.0, head top 5.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 49.1  | fail   | `hat:17:menu_idle`    | 0.748 (0.701) | -2.4 / 3.3 / -0.2 | 1.031 | 30.9 | head 6.0, head top 5.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 49.2  | fail   | `driver:BK:menu_idle` | 0.728 (0.694) | -1.3 / 3.0 / 0.2  | 0.963 | 21.9 | head 10.6, head top 17.9, left hand 8.7, right hand 7.3, seat 3.7  |      |
| 49.2  | fail   | `hat:34:steering`     | 0.778 (0.741) | 1.3 / 1.1 / 1.8   | 1.175 | 33.7 | head 3.5, head top 2.4, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 49.6  | fail   | `hat:34:seated`       | 0.771 (0.723) | 1.1 / -0.5 / 1.5  | 1.179 | 31.0 | head 3.2, head top 2.3, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 49.7  | fail   | `driver:BVB:seated`   | 0.767 (0.722) | 1.3 / -0.3 / -2.9 | 1.126 | 35.6 | head 2.3, head top 1.8, left hand 7.1, right hand 9.2, seat 8.1    |      |
| 49.9  | fail   | `hat:2:menu_idle`     | 0.750 (0.704) | -1.9 / 3.3 / -1.6 | 0.952 | 27.9 | head 4.9, head top 5.5, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.0  | fail   | `driver:JT:steering`  | 0.763 (0.721) | 3.2 / 1.0 / -4.2  | 1.065 | 23.8 | head 4.8, head top 4.4, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 50.0  | fail   | `hat:10:standing`     | 0.760 (0.723) | -0.9 / 0.9 / -0.7 | 0.867 | 49.4 | head 2.6, head top 3.3, left hand 10.7, right hand 11.4, seat 3.2  |      |
| 50.0  | fail   | `hat:18:standing`     | 0.738 (0.658) | -2.7 / 1.1 / -2.0 | 0.901 | 19.0 | head 7.5, head top 11.0, left hand 10.7, right hand 11.4, seat 3.2 |      |
| 50.0  | fail   | `hat:20:menu_idle`    | 0.748 (0.707) | -1.9 / 2.8 / -1.3 | 0.972 | 31.6 | head 4.7, head top 6.3, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.0  | fail   | `hat:21:menu_idle`    | 0.748 (0.707) | -1.9 / 2.8 / -1.3 | 0.972 | 33.2 | head 4.7, head top 6.3, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.0  | fail   | `hat:22:menu_idle`    | 0.748 (0.707) | -1.9 / 2.8 / -1.3 | 0.972 | 31.6 | head 4.7, head top 6.3, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.1  | fail   | `driver:RK:menu_idle` | 0.761 (0.722) | -1.8 / 2.9 / 1.4  | 0.974 | 50.5 | head 6.5, head top 10.4, left hand 8.7, right hand 7.3, seat 3.7   |      |
| 50.2  | fail   | `driver:WW:menu_idle` | 0.726 (0.675) | -2.4 / 3.6 / -1.2 | 0.978 | 21.3 | head 8.3, head top 9.9, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.3  | fail   | `hat:19:seated`       | 0.726 (0.600) | 3.0 / 0.3 / -0.9  | 0.982 | 25.9 | head 4.5, head top 4.2, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 50.4  | fail   | `driver:CR:seated`    | 0.766 (0.720) | 2.4 / 0.3 / -3.1  | 1.074 | 28.4 | head 3.8, head top 4.0, left hand 7.1, right hand 9.2, seat 8.1    |      |
| 50.4  | fail   | `driver:RH:menu_idle` | 0.754 (0.690) | -1.8 / 2.6 / 1.7  | 1.027 | 31.3 | head 6.0, head top 6.1, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.4  | fail   | `hat:24:steering`     | 0.764 (0.709) | 1.1 / 1.5 / -1.4  | 1.097 | 27.7 | head 6.7, head top 7.1, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 50.5  | fail   | `hat:28:menu_idle`    | 0.763 (0.717) | -0.6 / 3.1 / -1.5 | 0.947 | 43.2 | head 5.1, head top 6.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.5  | fail   | `hat:4:steering`      | 0.772 (0.721) | 2.5 / 1.4 / -1.6  | 1.044 | 31.8 | head 6.3, head top 6.2, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 50.5  | fail   | `hat:5:steering`      | 0.772 (0.721) | 2.5 / 1.4 / -1.6  | 1.044 | 49.8 | head 6.3, head top 6.2, left hand 8.9, right hand 8.7, seat 10.6   |      |
| 50.6  | fail   | `driver:RH:steering`  | 0.769 (0.683) | -0.3 / 1.1 / 3.1  | 1.138 | 27.9 | head 2.5, head top 2.4, left hand 8.9, right hand 8.7              |      |
| 50.6  | fail   | `hat:1:menu_idle`     | 0.763 (0.717) | -0.6 / 3.1 / -1.5 | 0.947 | 30.8 | head 5.1, head top 6.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.6  | fail   | `hat:29:menu_idle`    | 0.763 (0.717) | -0.6 / 3.1 / -1.5 | 0.948 | 44.8 | head 5.1, head top 6.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.6  | fail   | `hat:30:menu_idle`    | 0.763 (0.717) | -0.6 / 3.1 / -1.5 | 0.947 | 38.4 | head 5.1, head top 6.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.6  | fail   | `hat:35:menu_idle`    | 0.763 (0.717) | -0.6 / 3.1 / -1.5 | 0.947 | 33.4 | head 5.1, head top 6.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.7  | fail   | `driver:TC:steering`  | 0.731 (0.658) | 0.9 / 1.3 / 0.1   | 1.033 | 57.8 | head 4.1, head top 3.7, left hand 8.9, right hand 8.7              |      |
| 50.7  | fail   | `hat:4:menu_idle`     | 0.763 (0.703) | -1.4 / 3.9 / 0.6  | 0.971 | 32.1 | head 5.2, head top 5.3, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.7  | fail   | `hat:5:menu_idle`     | 0.763 (0.703) | -1.4 / 3.9 / 0.6  | 0.971 | 48.7 | head 5.2, head top 5.3, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 50.8  | fail   | `driver:JT:seated`    | 0.768 (0.718) | 2.9 / -0.3 / -3.4 | 1.091 | 22.8 | head 7.9, head top 8.1, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 50.8  | fail   | `driver:RK:standing`  | 0.792 (0.766) | -1.2 / 0.3 / 2.8  | 0.884 | 49.0 | head 3.3, head top 8.3, left hand 10.7, right hand 11.4, seat 3.2  |      |
| 51.0  | fail   | `driver:TC:menu_idle` | 0.744 (0.690) | -1.2 / 3.0 / -0.1 | 1.001 | 51.1 | head 5.2, head top 5.9, left hand 8.7, right hand 7.3, seat 3.1    |      |
| 51.1  | fail   | `driver:IL:steering`  | 0.741 (0.698) | 1.4 / 1.4 / 0.4   | 1.038 | 32.8 | head 4.1, head top 3.6, left hand 8.9, right hand 8.7              |      |
| 51.1  | fail   | `hat:5:seated`        | 0.769 (0.732) | 2.7 / 0.5 / -1.8  | 1.035 | 48.0 | head 5.8, head top 6.1, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 51.2  | fail   | `legs:3:standing`     | 0.784 (0.698) | -0.8 / -0.0 / 1.9 | 0.846 | 31.1 | head 1.5, head top 2.9, left hand 10.7, right hand 11.4, seat 3.2  |      |
| 51.3  | fail   | `hat:3:menu_idle`     | 0.756 (0.676) | -2.3 / 3.3 / -0.9 | 1.006 | 29.8 | head 4.8, head top 5.0, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 51.3  | fail   | `hat:4:seated`        | 0.769 (0.732) | 2.7 / 0.5 / -1.8  | 1.035 | 29.8 | head 5.8, head top 6.1, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 51.4  | fail   | `driver:AD:menu_idle` | 0.760 (0.692) | -2.0 / 2.6 / 2.1  | 1.013 | 37.1 | head 5.2, head top 5.6, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 51.4  | fail   | `driver:BK:standing`  | 0.750 (0.716) | -0.7 / 0.3 / 0.8  | 0.864 | 20.3 | head 8.2, head top 16.0, left hand 10.7, right hand 11.4, seat 3.2 |      |
| 51.4  | fail   | `hat:24:seated`       | 0.759 (0.703) | 1.3 / -0.3 / -1.9 | 1.087 | 26.4 | head 6.2, head top 7.0, left hand 8.7, right hand 9.2, seat 8.1    |      |
| 51.5  | fail   | `driver:BH:steering`  | 0.779 (0.734) | 0.8 / 2.0 / 3.5   | 1.074 | 37.9 | head 2.3, head top 2.7, left hand 8.9, right hand 8.7              |      |
| 51.5  | fail   | `hat:11:menu_idle`    | 0.788 (0.727) | -1.9 / 3.1 / 0.9  | 1.113 | 29.9 | head 4.7, head top 4.7, left hand 8.7, right hand 7.3, seat 3.7    |      |
| 51.6  | fail   | `driver:AD:seated`    | 0.758 (0.610) | -0.6 / -0.5 / 2.3 | 1.091 | 41.9 | head 1.8, head top 1.1, left hand 8.7, right hand 9.2              |      |
