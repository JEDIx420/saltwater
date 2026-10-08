# V0.2 validation — 8 October 2026

## Automated simulation checks

`node scripts/tests/gameplay.mjs`: **22 passed, 0 failed**. Coverage includes deterministic terrain/banks; bounded chunk streaming and unloading; swim acceleration/deceleration; normalized skin weights and actual tail deformation; four-leg articulation; land following; burst/rest stamina; dive/surface oxygen; small prey nutrition/growth; attack cooldown; buffalo grab → water roll → finite carcass feeding; release/escape; stalking awareness; blocked-shore fish height; basking/healing; death/restart; paused input cancellation; boundary/trunk collision; normalized camera-relative joystick; landmark discovery/waypoints; device-save round-trip/corruption rejection; outward body normals.

TypeScript `--noEmit` and ESLint for the game UI and game modules pass. Production framework build passes. The Three.js/game client bundle produces Vite's >500 kB chunk warning; assets require no separate downloads, and the client bundle is compressed in delivery. Loading the renderer is necessary for this full-screen game.

## Browser checks

Using the managed Sites preview in the cloud browser:

- Started an expedition with the desktop HUD and keyboard controls.
- Swam forward; turned; released movement; captured a fish with **F**. Observed the first milestone advance to **1 / 3**, nutrition to **84**, and growth to **5.1 m**.
- Dived and swam into deeper channel water. Observed **3.6 m depth**, underwater camera/fog and air decrease to **62%**. Surfaced and moved into wading and dry land; **B** activated basking and warmth recovery.
- Paused, saved on the device, and continued after the preview reloaded. Observed restored nutrition/warmth and **28 m explored**.
- Opened map and verified five landmark navigation choices/distances.
- Inspected CSS viewports **390 × 844**, **844 × 390**, and **360 × 740** through a temporary iframe harness. Reviewed HUD/control spacing, portrait and landscape start/gameplay layouts, and settings overlay.
- Enabled touch controls, held the captured joystick, dragged the world camera, and used Dive/Rise. On the final small-phone build, restarted, held the joystick for 1.1 seconds, tapped Bite, and observed a fish capture, **1 / 3** progress and **84 nutrition**.
- The captured phone image shows the actual final preview gameplay UI and compatibility-rendered 3D scene. The temporary viewport harness was removed before deployment.

## What remains unverified

The cloud browser reports that **WebGL is disabled**. It runs the reduced-detail CPU renderer, around **7–8 FPS** in this environment. This establishes UI and core gameplay behaviour; it does **not** establish GPU visual quality or frame rate. Production uses WebGL when available. Shader compilation, GPU performance, physical-phone multi-touch behaviour, thermal throttling, Safari and real-device frame rates still need device testing. Simultaneous multi-touch ownership is implemented through independent captured pointer IDs but cannot be reproduced with this browser's single mouse input.

The buffalo encounter is covered by the simulation tests, not a complete real-time buffalo hunt in the browser. This is a larger playable prototype, with simple wildlife AI, approximate collisions, synthesized audio, and browser-local saving rather than cloud sync.
