# SALTWATER v0.3 — Wildlife and animation repair

## World fixes

Land wildlife now searches for a valid habitat point before spawning. Buffalo check a 1.7 m footprint with clearance above the maximum tide; crabs use a smaller footprint. Fleeing, recovery from invalid locations, and respawns follow the same habitat constraints. Buffalo remain on shore until intentionally grabbed and dragged by the player. Buffalo carcasses float in water and rest above dry terrain.

Lily pads use a notched XZ mesh, rotate only around the vertical axis, and follow the actual water level on every frame, including frames that do not rebuild terrain chunks. A small clearance and polygon offset avoid coplanar surface flicker. Instances remain batched per chunk.

## Crocodile

The body has a continuous skinned silhouette and compressed muscular tail. Lower rectangular osteoderm plates replace pyramidal spikes. The broad skull has smaller eyes, raised nostrils, subtle cranial ridges, interleaved teeth and a separately hinged lower jaw. Surface colours, scale contrast and bump strength are revised.

Limbs have tapered upper and lower segments with shoulder/hip, elbow/knee and ankle joints. Front feet have five articulated digits; hind feet have four with visible webbing. Three digits on each foot carry dark horn claws. Rigid toe details are merged into their digit mesh to limit draw calls.

Swimming includes visible slow paddling, ankle feathering, and digit flexion. At burst speed the limbs fold toward the body while the tail supplies the larger wave. A continuous phase and damped speed/water blend avoid animation phase jumps between swimming and land movement. Land uses a diagonal gait with knee lift and ankle counter-rotation.

## Death roll

A 1.55 second sequence coils, accelerates through 360 degrees, and recovers. The axis passes through the spine. Limbs tuck, the head and tail cant, the jaw holds its grip, and the prey follows the jaw/body frame through the rotation. Prey damage is resolved at the end; bite/release cannot interrupt the sequence. Rolls need deep water and 22 stamina. Surface rolls generate bounded spray and ripples. The UI indicates Rolling and disables conflicting actions.

## Rendering and scope

The compatibility renderer splits intersecting objects at the water plane to avoid large water tiles painting over above-water limbs or pads. Its nearby terrain grid is refined to reduce terrain occlusion. WebGL remains the primary renderer; no external runtime assets, new services, or dependencies are added. Existing touch input, save format, quality presets and chunked expansion architecture are preserved.

Reference anatomy: Australian Museum, Estuarine Crocodile and Australian Museum Magazine volume 13 no. 6 (1960). Reference motion: Fish et al., Death roll of the alligator: mechanics of twist feeding in water (Journal of Experimental Biology, 2007; doi:10.1242/jeb.004267). Animation timings and exaggeration are gameplay design choices rather than biomechanical measurements.

## Validation — 8 October 2026

31 deterministic gameplay checks pass, including all spawn footprints over the tide range, invalid lagoon placement recovery, fleeing shore constraints, carcass grounding/respawn, lily pad height and yaw, digit/claw/web anatomy, moving swim joints, burst folding, water/land blending, and the full delayed roll/grip/feed sequence. Existing movement, survival, pause, collisions, joystick, exploration and save tests remain green.

In-browser checks: desktop orbit/zoom and land silhouette; a held-prey roll, pause/resume, completion and feeding (+24 nutrition / +9 growth); a frozen mid-roll inspection confirming attached prey and folded limbs; portrait 390x844, landscape 844x390 and small 360x740 CSS viewports; phone joystick stalking and Bite captured a fish (+14 nutrition / +8 growth). Temporary QA fixtures and viewport harness were removed from the delivered build.

The cloud browser disables WebGL. Browser verification used the reduced-detail compatibility renderer and does not establish GPU performance or physical-phone performance. WebGL visuals and real-device frame rates still need device testing.
