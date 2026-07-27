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

The scene reuses shared box, cylinder and sphere geometries scaled per
instance, so the whole furnished, three-storey house stays within a few hundred
draw calls. Shadows come from a single sun whose shadow frustum follows the
player. Target frame rate is 60 fps on a modern GPU.
