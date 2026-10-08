# SALTWATER — The Estuary, v0.3

A single-player crocodile survival game built with Three.js and React. This repository contains the v0.3 game from the privately hosted Sites build, packaged as a standalone Vite application. No Sites account, server, database, or runtime asset downloads are required.

## Play

- **WASD / arrows:** forward, reverse and turn. **Shift:** burst. **Ctrl:** stalk.
- **Drag:** orbit camera. **Wheel:** zoom. **V:** reset the camera.
- **F / left click:** bite prey in front of your snout, within 4.7 m.
- **C:** dive/rise in deep water. **Space:** rise.
- **R:** roll a held buffalo. A death roll needs deep water and resolves after the full turn.
- **E:** feed on a carcass, release held prey, or bask. **B:** bask on a dry bank.
- **M / J / Esc:** map / expedition journal / pause.
- On phones, use the thumb joystick and drag the world with your other thumb. Hold Burst, toggle Stalk, and tap the contextual actions.

Fish and crabs provide small meals. Buffalo detect movement and fight back: stalk from water, grab, drag, roll, then feed. Nutrition, air, stamina and warmth govern survival. Basking restores warmth and speeds healing. Feeding grows your crocodile from approximately 5 to 6.2 metres. Four optional expedition milestones and five landmarks guide open exploration.

## What is in this build

- A seeded **2 × 2 km** coastal world: meandering channels, a lagoon, a floodplain tributary, rainforest hills, ocean and islands.
- Streamed 100 m terrain chunks, vertex-coloured terrain, generated surface/bump textures, instanced trees, roots, reeds, bushes, leaves, rocks and lily pads.
- A skinned crocodile body and tail, nine bones, animated articulated shoulders, knees, ankles and individual digits, webbed hind feet, speed-sensitive paddling and tucking, a detailed jaw, eyes, teeth and scutes. Fish have articulated tails and fins; buffalo and crabs have animated limbs. Ambient birds fly overhead.
- Prey awareness, fleeing and shore avoidance; temporary grappling, stamina-limited rolls, carcasses with finite servings, growth, survival and death/restart.
- Pointer-captured joystick and camera inputs with separate owners; input cancellation, blur/visibility pause, responsive portrait and landscape HUDs, graphics presets and adaptive quality.
- Explicit **Save on this device**, stored only in the current browser. This is not cloud sync. Continue restores survival, growth, position and discoveries; wildlife is regenerated and diving/grappling transient state is cleared.
- Synthesized ambience and hunting sound. All visual game assets are procedurally authored locally. There are no paid assets, external asset requests or licence-gated downloads.

## Rendering and budgets

WebGL is the main renderer. Performance mode uses DPR ≤ 1 and disables shadows; Balanced uses DPR ≤ 1.35 and local 1024 px sun shadows; Cinematic extends streaming from 25 to at most 49 chunks and caps DPR at 1.7. Animals simulate only within 250 m. Terrain and foliage share geometry/materials with instanced draws; rigid animal details are merged into vertex-coloured meshes. Shader water uses a static low-resolution height map and analytic ripples rather than expensive reflections. Slow WebGL frames automatically lower quality until the user selects a preset.

A CPU triangle-rendering fallback runs the same simulation if WebGL cannot be created. It intentionally uses simpler lighting, terrain, foliage and resolution. It is a compatibility option, not equivalent to WebGL visual quality or performance.

## Architecture

- `lib/game/world.ts`: deterministic terrain, habitats, chunk streaming and landmarks.
- `lib/game/models.ts`, `materials.ts`, `batching.ts`: authored geometry, animation and draw-call reduction.
- `lib/game/engine.ts`: fixed 60 Hz simulation, prey AI, survival, camera and render lifecycle.
- `lib/game/input.ts`: renderer-independent normalized joystick math.
- `lib/game/storage.ts`: versioned, validated device save format.
- `app/game.tsx`, `app/globals.css`: HUD, overlays and pointer ownership.

Input is independent of movement simulation; the world is chunked and seeded. This supports later controller inputs, expanded regions and additional species. It is a bounded prototype with simple prey AI and no multiplayer or cloud saving.

## Development and checks

Use Node.js 22.13 or later and pnpm 11.25.0 (the version recorded in `package.json`).

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. To run the checks and build:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

`pnpm build` creates a static `dist/` directory. The Vite base path is relative, so the build can be served from a domain root or a subdirectory such as `/saltwater/`. Nothing in this repository enables GitHub Pages or changes the existing private Sites deployment. To use another static host later, upload the contents of `dist/`.

`app/game.tsx` and all `lib/game/` modules are unchanged from the v0.3 Sites game. Only the entry point and build setup differ. See `docs/V3_CHANGES.md` for the latest fixes and validation limits; `docs/V2_DESIGN.md` and `docs/V2_VALIDATION.md` retain the earlier design and test history. The standalone packaging is checked with TypeScript, all 31 gameplay tests, and a Vite production build. Physical-phone GPU performance remains unverified.

The game assets are original procedural geometry and generated textures. Third-party code retains its upstream licences; see `THIRD_PARTY_NOTICES.md`. No overall project licence has been selected in this repository.
