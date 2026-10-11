// The figure widget of a screen (`FUN_0047e0a0`, class at the screen's `+0x22dc`, `FUN_0047df90`): its position is the
// three floats the screen's initialiser passes (the last three words of the widget's description block).
// The main menu (`0x00480e40`): (0x41917328, 0xc129f6d2, 0x3cd29995) = (18.18, -10.62, 0.0257), turned to face (0x3f78ed3e,
// 0xbe6f0c35, 0) = (0.9724, -0.2334, 0) with up (0, 0, 1) (the frame's `+0x40` call at the end of the initialiser).
export const MAIN_MENU_FIGURE_POSITION: readonly [number, number, number] = Object.freeze([
  18.181229, -10.622759, 0.025708,
])
export const MAIN_MENU_FIGURE_FORWARD: readonly [number, number, number] = Object.freeze([
  0.97237, -0.233445, 0,
])
// The driver editor (`0x0047d230`): (0xc0ab7cee, 0xc049999a, 0x3cd4fdf4) = (-5.359, -3.15, 0.026); no orientation call.
export const EDITOR_FIGURE_POSITION: readonly [number, number, number] = Object.freeze([
  -5.359, -3.15, 0.026,
])
export const IDENTITY_FIGURE_FORWARD: readonly [number, number, number] = Object.freeze([1, 0, 0])

// 0x00481000: the main menu shows the figure of the driver at `DAT_004c214c[run]` of the driver database
// (`FUN_00421050` copies the driver's five unread bytes, +0x2b..+0x2f), where `run` is how many circuits after the first
// are unlocked in a row (`FUN_00443760`): Captain Redbeard (cr), then kk, bb, jt, bvb and gm; a run of six reads the next byte of the table, 0: the driver rr.
export const MAIN_MENU_FIGURE_DRIVER_INDICES: readonly number[] = Object.freeze([
  0x13, 0x12, 0x16, 0x15, 0x14, 0x17, 0x00,
])
