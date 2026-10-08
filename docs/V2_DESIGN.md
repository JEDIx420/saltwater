# SALTWATER v0.2 — Living Estuary

The second version keeps the private, link-playable single-player experience and procedural art, while replacing the sparse first world and its minimal input/gameplay systems.

## Design thesis

A nature-documentary coastal wilderness, seen from the low, powerful body of a crocodile. Organic silhouettes, bright shallow water, dark tangled roots, layered vegetation, warm afternoon light. The playable scene carries the experience; HUD is sparse, readable, and suitable for thumbs.

## Acceptance targets

- Anatomically improved continuous crocodile body/tail, raised scutes, broad snout, eyes, nostrils, teeth, articulated shoulders/knees/toes, distinct idle/walk/swim/bite/roll poses.
- Distinct fish silhouettes with animated tail/fin motion; articulated crabs and buffalo.
- 2 × 2 km seeded world, streamed terrain/vegetation chunks, braided river, mangrove roots, lagoon, floodplain, rainforest and coast, recognizable exploratory landmarks.
- Visible water motion, shore shallows, ripples, light/sky/time/tide, ambient birds. Instancing, LOD, capped pixels and adaptive detail.
- Hunt small prey; stalk larger prey; bite and grab a buffalo, manage stamina, roll and feed. Prey awareness, fleeing, habitat boundaries and regeneration.
- Survival nutrition, stamina, oxygen, warmth, basking, health/death/restart, growth and optional exploration milestones.
- Keyboard and orbit camera; pointer-captured thumb joystick, independent camera drag, large action buttons, landscape and portrait HUD with safe areas; cancellation/blur/pause clear every held input.
- Device-local save is an explicit game action with its location clearly labeled; users can continue a saved expedition on the same browser/device. No server or cloud-save claim.
- Meaningful simulation checks plus browser QA of primary actions and responsive layouts. Distinguish software fallback verification from GPU/device performance.
- Keep the existing Site private, source tracked in its own Sites repository; no GitHub changes.

## Resources

- Three.js official SkinnedMesh, InstancedMesh and geometry documentation.
- MDN Pointer Events, pointer capture and multi-touch cancellation documentation.
- Original procedural geometry and generated material data. No opaque or unlicensed model imports and no external downloads required for play.

## Architecture

World generation, animal presentation, simulation/input, storage and HUD stay separate. A finite deterministic height field defines terrain, map, habitat and collisions. Streamed rendering is a view of that same field. Input from keyboard, touch and UI routes to the same actions. Software rendering shares the models and simulation and uses its own detail budget.
