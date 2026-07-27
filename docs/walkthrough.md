# Villa walkthrough

An interactive, first-person walkthrough of a three-storey 3BHK villa. It runs
in the browser with Three.js and is served from the `/walkthrough` route. The
geometry is generated from the architectural drawings — no external 3D assets.

## Run it

```bash
pnpm dev
# open http://localhost:3000/walkthrough
```

Click **Enter the villa** to start. The browser asks for pointer lock; press
`Esc` to release the mouse.

## Controls

| Input           | Action                                |
| --------------- | ------------------------------------- |
| `W` `A` `S` `D` | Walk                                  |
| Mouse           | Look                                  |
| `Shift`         | Run                                   |
| `Space`         | Jump                                  |
| `C` / `Ctrl`    | Crouch                                |
| `E`             | Open the nearest door or gate         |
| Control bar     | Time, camera, floor, roof/walls, shot |

On a phone, use the Orbit, Drone, Top or Cinematic camera modes to explore
without a keyboard.

## What is modelled

The plan is the source of truth. Every room in the drawing is present on each
of the three floors: living, dining, kitchen, three bedrooms, three bathrooms,
pooja, utility, lift and staircase, plus the front and rear balconies. The site
adds the boundary wall, sliding gate, driveway, garden and street. The roof
carries a parapet, stair headroom and a water tank.

## How it is built

All Three.js code sits behind a `'use client'` boundary and a dynamic import,
so the route ships no 3D code on the server and the engine loads as its own
browser bundle.

```
components/walkthrough/
  VillaWalkthrough.tsx     React ↔ engine bridge (client)
  ui/                      presentational overlay (no three.js)
  engine/
    plan.ts                the floor plan, transcribed to metres
    houseBuilder.ts        walls, openings, slabs, stairs, roof
    furniture/             per-room props and placement
    exterior/site.ts       compound, gate, garden, facade accents
    materials.ts textures.ts  procedural PBR materials
    sky.ts lighting.ts timeOfDay.ts  sky dome, sun/fill, day-night presets
    postfx.ts              bloom + SMAA + ACES output
    controls/              first-person movement and camera director
    interaction/doors.ts   hinged doors and gate
    Engine.ts              orchestrates the scene and the frame loop
```

The floor plan lives in one place: `engine/plan.ts`. Rooms are rectangles in
feet, converted to metres. Interior walls are derived from the shared edges of
those rectangles, then doors and windows are punched by world position. To
change the layout, edit the plan — the walls follow.

## Performance

Target frame rate is 60 fps on a modern GPU. The scene is kept cheap by four
measures, in order of impact:

- **Static geometry batching** (`engine/merge.ts`). After the builders run,
  every static mesh is baked into world space and merged by material into a
  handful of large meshes. The furnished three-storey house draws in ~170 calls
  instead of several thousand. Hinged doors and the gate are tagged
  `dynamic` and stay separate so they still animate.
- **Capped interior lights**. Forward rendering pays for every active light per
  pixel, so only the six point lights nearest the camera are shaded at once; the
  rest are hidden. The house can have any number of rooms at no extra cost.
- **Static shadows**. The sun is anchored to the house, not the player, so its
  shadow map is rendered only when the time of day (or a hidden wall) changes —
  not every frame.
- **Pixel-ratio cap** at 1.5, and no `preserveDrawingBuffer`. Screenshots render
  one synchronous frame on demand instead of keeping every frame readable.

Geometry itself reuses shared box, cylinder and sphere primitives scaled per
instance, so buffer memory stays flat before merging too.
