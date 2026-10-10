# Game map: `LEGORacers.exe` and `GolDP.dll`

Source: `LEGORacers.exe` and `GolDP.dll` (English, both built 1999-07-22). Addresses are virtual addresses (exe base `0x00400000`, DLL base `0x10000000`). Every claim below comes from decompiled or disassembled code at the address given. Anything not proven by code is marked **hypothesis**.

Names used here are applied by `reverse-engineering/scripts/ApplyNames.java` from `reverse-engineering/names/LEGORacers.exe.txt` and `reverse-engineering/names/GolDP.dll.txt`. The file formats are in [file-formats.md](file-formats.md).

## How the map was made

Auto-analysis of the shared project finds 4,996 exe functions. Code reached only through vtables is missed, so `RecoverCodeGaps.java` seeds functions in uncovered `.text` ranges (exe: 6,171 functions afterwards; DLL: 1,159 → 1,571). `DumpProgram.java` then writes every decompiled function with its callers, every string with the functions that use it, and every import with its call sites. `FindInstructions.java` lists instructions by mnemonic (used for the FPU survey).

## Startup

| Address      | Name                               | What it does                                                                                                                                                                                           |
| ------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0x004a867c` | `entry` (MSVC CRT)                 | `__set_app_type(2)`, `SetDefaultFpuPrecision`, `__getmainargs`, then `WinMain(GetModuleHandleA(0), 0, commandLineTail)`                                                                                |
| `0x004a87f8` | `SetDefaultFpuPrecision`           | `_controlfp(0x10000, 0x30000)`: `_PC_53` under `_MCW_PC` (53-bit precision)                                                                                                                            |
| `0x00449d50` | `WinMain`                          | `CoInitialize(0)`; stores `hInstance` (`0x004c47e4`); `srand(<address of timeGetTime>)` (see Determinism); copies the command line (256 bytes); `SplitCommandLine`; `RunGameApplication`               |
| `0x00449ce0` | `SplitCommandLine`                 | Splits at spaces into at most 32 arguments (`0x004c6fec`, count `0x004c6fe8`)                                                                                                                          |
| `0x0042f870` | `RunGameApplication`               | `GameApplication_Initialize(&0x004c4a38, argc, argv)`, then `GameApplication_Run`                                                                                                                      |
| `0x0042b9d0` | `GameApplication_Constructor`      | Global object at `0x004c4a38`, vtable `0x004b0568` (base `0x004affa4`); default race folder `racec0r0`                                                                                                 |
| `0x0042bee0` | `GameApplication_ParseCommandLine` | `-novideo` (`+0xa18 = 0`), `-primary` (`+0xab8 \|= 0x80`), `-select3d` (`\|= 0x200`), `-window` (`&= ~8`), `-alphatrans`, `-horzres n`, `-vertres n`; anything else shows the usage box (`0x0042bec0`) |
| `0x0042bbb0` | `GameApplication_Initialize`       | Parses the command line, then calls the application's slot `+0x0c` with `"LEGO Racers"` and `lego.jam`                                                                                                 |
| `0x004165e0` | `Application_CreateWindow`         | Registers `AolAppWinClass` (window procedure `0x00417330`), creates the window, calls slots `+0x14` and `+0x1c`, gives the window to the Gol device, starts the frame clock                            |
| `0x00416860` | `Application_OpenJamArchive`       | Opens `lego.jam` through `JamArchive_Open` (`0x0044d870`)                                                                                                                                              |
| `0x00416960` | `Application_LoadGolDll`           | Loads the Gol DLL and calls `GolEntry` (below)                                                                                                                                                         |
| `0x0042bc40` | `GameApplication_Run`              | Plays `lmicmp.avi`, `hvscmp.avi`, `introcmp.avi` at 640×480 unless `-novideo`; `0x0042be00` initialises the display; then loops `RunFrontEnd` / `RunRaceSession` while `+0xabc` is non-zero            |

### Loading the Gol DLL

`Application_LoadGolDll` (`0x00416960`) picks the DLL from flags at application `+0x928`: bit 2 → `GolGlide.DLL`, else bit 1 → `GolSoft.DLL`, else bit 4 → `GolD3D.DLL`, else `GolDP.DLL`. The only writes to `+0x928` are zeroes (`0x004164d0`, `0x004167e0`), so this build always loads **`GolDP.DLL`**; the other three are dead code.

It then calls `GetProcAddress("GolEntry")` and `GolEntry(parameters)`. `BuildGolEntryParameters` (`0x00450d80`) fills the parameter block:

| Offset | Value                                                              |
| ------ | ------------------------------------------------------------------ |
| `0x00` | `0x004c7394`                                                       |
| `0x04` | `0x004c7398`                                                       |
| `0x08` | up to `[0x18]` dwords copied from `0x004c7384`                     |
| `0x18` | count of the dwords above (`0x004c739c`)                           |
| `0x1c` | `0x004c73a0`: the JAM archive object (application `+0x7dc`)        |
| `0x20` | `0x004c73f0`                                                       |
| `0x28` | `ShowFatalError` (`0x0042f8b0`), stored by the DLL at `0x1006314c` |

`GolEntry` (`0x10006ff0`) stores the block (`0x10032b80`), allocates the **Gol root** (`0xc8ac8` bytes, vtable `0x10056440`) whose `+4` is the **Gol device** (constructor `0x10001000`, vtable `0x10056140`) and returns the root. The exe keeps the root at application `+0x800` and `root->GetDevice()` at `+0x804`. `GolExit` (`0x100070b0`) calls the root's destructor; `Application_UnloadGolDll` (`0x00416a30`) calls `GolExit` and `FreeLibrary`.

### Gol root interface (vtable `0x10056440`, 28 slots)

Slots 2–14 allocate an object and run its constructor; slots 15–27 destroy one through its own virtual destructor. Roles come from the loader each class's vtable contains.

| Slot | Offset | Function     | Object (size, constructor, vtable)                     | Role                                                                  |
| ---- | ------ | ------------ | ------------------------------------------------------ | --------------------------------------------------------------------- |
| 0    | `0x00` | `0x10007040` | —                                                      | Destructor                                                            |
| 1    | `0x04` | `0x10015090` | returns `this + 4`                                     | `GetDevice`                                                           |
| 2    | `0x08` | `0x100150a0` | `0x118`, `0x10017190`, `0x1005690c`                    | World (WDB loader `0x1002c240`)                                       |
| 3    | `0x0c` | `0x10015110` | `0x24`, `0x10015920`, `0x100567f0`                     | Texture database (TDB `0x1002b5a0`)                                   |
| 4    | `0x10` | `0x10015180` | `0x20`, `0x10006680`, `0x100563d0`                     | Material database (MDB `0x10026270`)                                  |
| 5    | `0x14` | `0x100151f0` | `0x48`, `0x10006840`, `0x100563fc`                     | Hypothesis: model (its constructor builds a GDB object, `0x10027020`) |
| 6    | `0x18` | `0x10015260` | `0x1c`, `0x100148e0`, `0x1005672c`                     | Skeleton (SDB `0x10029a20`)                                           |
| 7    | `0x1c` | `0x100152d0` | `0x2c`, `0x1001adc0`, `0x10056b68`                     | BSP (BDB `0x1001ae50`)                                                |
| 8    | `0x20` | `0x10015340` | `0x344`, `0x10001ea0`, `0x100561f8`                    | Unknown                                                               |
| 9    | `0x24` | `0x100016f0` | returns 0                                              | Not supported by GolDP                                                |
| 10   | `0x28` | `0x100153b0` | `0xa4`, `0x10004fd0`, `0x10056340` (base `0x10056300`) | Unknown                                                               |
| 11   | `0x2c` | `0x10015420` | `0xa0`, `0x100043d0`, `0x100562dc` (base `0x10056300`) | Unknown                                                               |
| 12   | `0x30` | `0x10015490` | `0x4c`, `0x10029df0`, `0x10056760`                     | Unknown                                                               |
| 13   | `0x34` | `0x10015500` | `0x20`, `0x10005d10`, `0x10056364`                     | Image database (IDB `0x10023060`)                                     |
| 14   | `0x38` | `0x10015570` | `0x2c`, `0x10003fb0`, `0x100562b4`                     | Font database (FDB `0x1001d8f0`)                                      |
| 15   | `0x3c` | `0x100155e0` | calls the object's slot `+0x10`                        | Destroy                                                               |
| 16   | `0x40` | `0x10015600` | calls the object's slot `+0x00`                        | Destroy (also slots 17, 19, 20, 26, 27)                               |
| 18   | `0x48` | `0x10015620` | calls the object's slot `+0x20`                        | Destroy                                                               |
| 21   | `0x54` | `0x10015640` | calls the object's slot `+0x08`                        | Destroy                                                               |
| 22   | `0x58` | `0x1002c020` | empty                                                  | —                                                                     |
| 23   | `0x5c` | `0x10015660` | calls the object's slot `+0x14`                        | Destroy                                                               |
| 24   | `0x60` | `0x10015680` | calls the object's slot `+0x1c`                        | Destroy                                                               |
| 25   | `0x64` | `0x100156a0` | `operator delete`                                      | Destroy                                                               |

The World creates the per-world objects itself: animation (ADB, class `0x100187e0`/vtable `0x10056a50`) and material animation (MAB, `0x10025890`/`0x10057034`) in `World_CreateResources` (`0x10017390`), and 100-byte bounding-volume objects (BVB, `0x1001b770`) in `World_AllocateVolumes` (`0x1002e2c0`).

The Gol device (vtable `0x10056140`) is the DirectDraw/Direct3D wrapper. Slot 0 (`0x100012d0`) creates DirectDraw, picks a 3D device and sets the cooperative level (see Numerics); slot 2 (`0x100011e0`) receives the window. Its other ~57 slots are not mapped yet.

## Main loop and timing

### Frame clock: `Application_PumpMessagesAndMeasureFrame` (`0x00416ef0`, application slot `+0x34`)

Called once per frame by whatever loop is running (race loop, menus). It drains the Windows message queue (`PeekMessageA`; `WM_QUIT` returns 0), then:

```c
delta = timeGetTime() - lastTime;            // milliseconds, uint32
if (delta > maximumDelta) delta = maximumDelta;    // +0x828, set to 100 by 0x004162c0
else if (delta < 12) {                       // frame-rate cap
    Sleep(12 - delta);
    delta = timeGetTime() - lastTime;        // re-measured, not clamped again
}
lastTime = now;                              // +0x820
frameDelta = delta;                          // +0x824
if (+0x938) inputManager->Update(delta);     // +0x834, slot +0x10
```

- The **only** timer is `timeGetTime` (WINMM). `QueryPerformanceCounter` is not imported and `timeBeginPeriod` is not called.
- `timeSetEvent(100, 100, 0x0041a110, …)` in `TuneStream_Start` (`0x0041a360`) drives music streaming on a separate thread; it does not touch the simulation.
- `frameDelta` is an **integer number of milliseconds**, normally 12–100.

### Race loop: `Race_RunLoop` (`0x00432540`)

```c
while (running && application->PumpMessagesAndMeasureFrame()) {
    handle queued events (0x0044b7f0);
    if (!paused /* application +0x82c */) {
        if (!race[0x30c0]) stateTimer += frameDelta;     // race +0x332c, milliseconds
        switch (race state /* +0x3328 */) { 1: 0x004349a0  2: 0x00434b00  3: 0x00434c80  4: 0x00434eb0  5: 0x00435180 }
        race->Update();                                   // vtable +0x30 = Race_Update
        Race_Render(race);                                // 0x004354d0
        application->EndFrame();                          // vtable +0x08 → Gol device slot +0x4c (present, hypothesis)
        frames-per-second average over 64 frames: 1.0f / (averageMilliseconds * 0.001f)
    }
}
```

The state functions only compare `stateTimer` against fixed durations (1,999, 2,999, 9,000, 9,501 (`0x251d`), 9,999, 4,000 and 5,000 ms) and switch state.

### Simulation step: `Race_Update` (`0x00435220`, race vtable `0x004b07f4` slot `+0x30`)

```c
dt = frameDelta;                                          // integer ms
if (settings[+0x20] & 0x100) dt = _ftol(dt * 1.75f);      // constant 0x004b08c0
… per-frame updates with the whole dt: timers, power-ups (0x0045a490), events, hazards, emitters,
  sound, sky, player controllers (0x00430530, stride 0x74 at race +0x258), force-feedback (0x00421e30) …
remaining = dt;
while (remaining != 0) {
    step = remaining <= 40 ? remaining : 40;              // 0x28
    remaining -= step;
    RacerSet_Step(race + 0x3bc, step);                    // 0x0043c030: all racers, physics
    for each local player: Camera_Update(camera, (float)step);   // 0x00428540, stride 0x150 at +0x2ad4
    if (ghost) GhostRecorder_RecordSample(ghost, step);   // 0x00422710
}
```

**Tick model: variable timestep, frame-rate dependent.** The physics runs once per frame with the measured frame time, split into sub-steps of at most 40 ms (in practice one sub-step, because the frame is capped at 12–100 ms; two or three only for frames over 40 ms). Inside a racer, `RigidBody_Step` (`0x00444ef0`) splits the step again at contacts: `RigidBody_AdvanceToContact` (`0x004478b0`) returns the milliseconds left after a collision and the loop integrates the rest. `RigidBody_Integrate` (`0x00440e10`) works in `float` milliseconds (`(float)dt`, half-step constant `0.5f` at `0x004af58c`).

Consequences for a deterministic server: the simulation is a pure function of (1) the sequence of integer `dt` values, (2) the input sampled once per frame (`0x00416ef0` → input manager, `0x00430120` integrates steering with `dt * 0.001f`), (3) the random-table cursor (below), and (4) the FPU precision. A server can feed any fixed `dt` in 12–40 ms and stay deterministic, but results will differ from a PC running at another frame rate, exactly as the original does.

### Determinism: random numbers

- `rand` is **not imported** and no linear-congruential constants (`0x343fd`, `0x41c64e6d`, `0x19660d`, …) appear in either binary.
- `WinMain` passes the _address_ of the `timeGetTime` import to `srand` (`0x00449d59`: `mov edx, [0x004af200]; push edx`), which has no effect.
- All randomness reads a **1,024-entry `uint16` table** at `0x004befec` (values 0–1023) through a global cursor at `0x004c6ee4`: `cursor = (cursor + 1) & 0x3ff; value = table[cursor]`. About 40 functions do this, including AI route choice (`Race_LoadAiRoutes`), racer behaviour (`0x00438560`, `0x00439240`), power-ups (`0x0045b550`), the driver figure (`0x0041fc00`) and menus (`0x0047d5d0`). The cursor is never reset, so the menus advance it too: a multiplayer port must synchronise the cursor at race start.

## Subsystems

| Subsystem             | Where                                       | Constructor  | Vtable       | Size     | Key methods                                                                                                                                                                     |
| --------------------- | ------------------------------------------- | ------------ | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application (window)  | game application `+4`                       | `0x004164d0` | `0x004af9f4` | —        | `CreateWindow 0x004165e0`, `LoadGolDll 0x00416960`, pump `0x00416ef0`                                                                                                           |
| Game application      | global `0x004c4a38`                         | `0x0042b9d0` | `0x004b0568` | —        | `Initialize 0x0042bbb0`, `Run 0x0042bc40`                                                                                                                                       |
| Sound system          | game application `+0x948`                   | `0x004185d0` | `0x004afaf0` | —        | DirectSound set-up `0x004186f0`; sound/music lists `FileList_Load 0x0041a700`                                                                                                   |
| Input manager         | application `+0x834`                        | `0x00450300` | `0x004b1224` | —        | `DirectInputCreateA` in `0x004503e0`; device classes `0x004b10a8`, `0x004b1114`, `0x004b1180`, `0x004b11ec`; `Race_AcquireControllers 0x004343e0`                               |
| Front end (menus)     | —                                           | —            | many         | —        | `FrontEnd_Run 0x0042b1e0`; menu descriptions `0x0046b890` (MIB), styles `0x0046fc40` (MSB)                                                                                      |
| Race session          | heap, per race or circuit                   | `0x0042c1b0` | none         | `0x37b8` | `RaceSession_Run 0x0042b130`, `Play 0x0042c330`                                                                                                                                 |
| Circuit runner        | race session `+0x04`                        | `0x0041ec10` | —            | —        | `PlayCircuit 0x0041ed80`: up to four races, loads each RAB and runs `Race_RunLoop`                                                                                              |
| Race                  | race session `+0x98`                        | `0x004316e0` | `0x004b07f4` | `0x3368` | `LoadRaceDescription 0x00431e00`, `LoadTrackContent 0x00433480`, `RunLoop 0x00432540`, `Update 0x00435220`, `Render 0x004354d0`                                                 |
| Ghost                 | race session `+0x3400`                      | `0x00422350` | `0x004b01a0` | —        | `Load 0x00423160` (GHB), `RecordSample 0x00422710` (every 250 ms, at most 960 samples)                                                                                          |
| Racer set             | race `+0x3bc`                               | —            | —            | —        | `Setup 0x0043b190`, `LoadStartPositions 0x0043bc10`, `Step 0x0043c030`                                                                                                          |
| Racer                 | array at racer set `+0x140`, count `+0x144` | `0x00436990` | `0x004b09b0` | `0xe34`  | Vehicle at `+0x18` (`0x0043d5a0`, `Update 0x0043e070`); car body at `+0x3e8` (`0x00429020`, vtable `0x004b04e4`, `Update 0x004293f0`); driver figure at `+0xc70` (`0x0041fb50`) |
| Rigid body            | base of the car body                        | —            | `0x004b0d8c` | —        | `Step 0x00444ef0`, `Integrate 0x00440e10`, `AdvanceToContact 0x004478b0`; fields in [physics.md](physics.md)                                                                    |
| AI routes             | race `+0x3104`, stride `0x48`               | —            | —            | `0x48`   | `Race_LoadAiRoutes 0x00433190`, `AiRoute_Load 0x004a4e30` (RRB)                                                                                                                 |
| Player controller     | race `+0x258`, stride `0x74`                | —            | —            | `0x74`   | `Update 0x00430530`, steering `0x00430120`                                                                                                                                      |
| Camera                | race `+0x2ad4`, stride `0x150`              | —            | —            | `0x150`  | `AttachRacer 0x00428230`, `Update 0x00428540`                                                                                                                                   |
| HUD                   | race `+0x283c`, two of them, stride `0x140` | —            | —            | `0x140`  | `Initialize 0x00425d80`, `Update 0x00426390`                                                                                                                                    |
| Power-ups and bricks  | race `+0x6dc`                               | —            | —            | —        | `Initialize 0x00457c20`, `Load 0x00458810` (PWB), `Update 0x0045a490`; effect strings `0x004b1350`–`0x004b1a80`                                                                 |
| Checkpoints           | race `+0x27f4`                              | —            | —            | —        | `Load 0x0041e770` (CPB, "Too many CheckPoints")                                                                                                                                 |
| Triggers, timers      | race `+0x2080`, `+0x2128`, `+0x213c`        | —            | —            | —        | `0x00463dc0` / `0x00464ff0` → `Triggers_Load 0x00465210` (TRB); `Timers_Load 0x00464aa0` (TIB)                                                                                  |
| Events                | race `+0x2098`                              | —            | —            | —        | `Load 0x0045efa0` (EVB), `Update 0x00461cc0`                                                                                                                                    |
| Hazards               | race `+0x2148`                              | —            | —            | —        | `Load 0x0048a4d0` (HZB), `Update 0x0048add0`                                                                                                                                    |
| Emitters              | race `+0x2150`, `+0x248c`                   | —            | —            | —        | `Load 0x00489af0` (EMB), `Update 0x00489fa0`                                                                                                                                    |
| Sky                   | race `+0x2f90`                              | —            | —            | —        | `Load 0x0041c550` (SKB), `Update 0x0041ccb0`                                                                                                                                    |
| Load screen           | race `+0x280c`                              | —            | `0x004b0698` | —        | `Load 0x0042f480` (LSB)                                                                                                                                                         |
| Strings               | race `+0x30f0`                              | —            | `0x004b0ffc` | —        | `StringTable_Load 0x0044e2c0` (SRF `game.srf`)                                                                                                                                  |
| Token reader (binary) | heap                                        | `0x0044a7e0` | `0x004b0e0c` | `0x650`  | `NextToken 0x0044aae0`; see file-formats.md                                                                                                                                     |
| Token reader (text)   | heap                                        | `0x0044e580` | `0x004b0ffc` | `0x1fc`  | used when the settings' JAM pointer (`+0x18`) is null                                                                                                                           |
| Vector maths          | —                                           | —            | —            | —        | `Math_SinCos 0x00449170` (`fsincos`), `0x00449280`, `0x00449460`, `0x004496a0`                                                                                                  |

Game settings (the object at race `+4`, also `RaceSession +0`): `+0x18` JAM archive or null (text files), `+0x20` flags (`0x100` = 1.75× time), `+0x24` mode (0 = circuit; 2 loads a ghost from `GAMEDATA\COMMON`, hypothesis: time trial; others single race), `+0x100` racer count, `+0x114 + 0x5c·i` racer kind (2 = computer), `+0x32c` local players.

## Numerics

- **Every stored floating-point value in the exe is 32-bit.** Of 14,979 x87 instructions, none loads or stores a `qword` float (`FILD qword` occurs 4 times, for integers); the only `qword` float operands are two `FCOM`s against the 0.0 at `0x004b0df0` in the vector normalizers (`0x00449291`, `0x004492f3`, see [physics.md](physics.md)). Intermediate results stay on the x87 stack between loads and stores.
- **No fixed point in the physics.** Fixed point appears only when decoding resource files (binary token types `0x0f` = `int16 / 4096`, `0x10` = `int16 / 32`, `0x12` = `uint8 / 127`) and in the ghost recording (`int16` positions).
- **FPU control word.** The CRT sets 53-bit precision (`0x004a87f8`). Neither the exe nor the game code in the DLL executes `FLDCW` outside library code: the exe uses MSVCRT `_ftol` (truncation, imported), the DLL's `__ftol` (`0x1004b808`) sets round-toward-zero around `FISTP` and restores. The DLL's software rasteriser (`0x10041a60`, `0x10042020`, `0x10042bd0`) switches to 24-bit precision around span set-up and restores.
- **Direct3D FPU set-up.** `GolDevice_Initialize` (`0x100012d0`) calls `IDirectDraw::SetCooperativeLevel` with `0x808`, `0x810` or `0x811`: every variant includes `DDSCL_FPUSETUP` (`0x800`) and none `DDSCL_FPUPRESERVE` (`0x1000`). **Hypothesis (DirectX runtime behaviour, not in this code):** Direct3D then leaves the x87 in single (24-bit) precision while the game runs, so every x87 arithmetic result is rounded to a 24-bit mantissa. If true, `Math.fround` after every operation reproduces the original; with 53-bit precision, compute in doubles and round only at stores. Verify by reading the control word during a race in an emulator or debugger before porting physics.
- **Transcendentals:** `fsin`, `fcos`, `fsincos`, `fptan`, `fsqrt` instructions (about 40 functions, e.g. `0x00449170`, `0x00449460`) and MSVCRT `_CIacos` (`0x00428f40`). `fsqrt` is correctly rounded; x87 `fsin`/`fcos` are not, so `Math.sin`/`Math.cos` can differ in the last bit.
- **Float to integer:** always `_ftol` (truncation toward zero), never the current rounding mode.
- **Time is integer milliseconds** until a function converts it with `(float)dt` (rigid body, camera) or `dt * 0.001f` (`0x004af220`, player steering).
