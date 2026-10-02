# Type Shop — grab letters with your real hands

A browser-based first-person store where the products are **3D letters**. Each
shelf holds one typeface, and the shelves run roughly through type history: from
Gutenberg-era blackletter, through old-style, Didone and slab serifs, to grotesque,
geometric and humanist sans-serifs, monospace and script. Your Mac's webcam tracks
your hands (MediaPipe HandLandmarker). Pinch to pick letters off the shelves, then
carry them, pass them between hands, toss them, and drop them into the basket to
spell words. You don't need a VR headset: just a laptop camera.

## The typefaces

| Shelf unit | Top → bottom |
| --- | --- |
| Left (serifs) | Blackletter: UnifrakturMaguntia · Old-style: Sorts Mill Goudy · Modern/Didone: Old Standard · Fat face: Abril Fatface |
| Middle (slabs & early sans) | Slab serif: Arvo · Slab display: Alfa Slab One · Grotesque: Archivo Black · Geometric: Poppins |
| Right (later sans & beyond) | Humanist: Fira Sans · Condensed: Bebas Neue · Monospace: Space Mono · Script: Lobster |

The letters are real glyph outlines. opentype.js reads them from the TrueType
files in `public/fonts/`, and Three.js extrudes them into 3D. Every typeface is set
at the same cap height, so you can compare proportions directly. A label strip
under each shelf names the classification and the typeface, set in that typeface.
When you hover over or hold a letter, a card at the bottom of the screen shows its
typeface, classification and a short note. The HUD spells out the basket's
contents from left to right, with each letter in its own typeface.

To change which letters or fonts appear, edit `src/typefaces.ts`. Any `.ttf` you
drop into `public/fonts/` will work. All the bundled fonts are SIL Open Font
License fonts from Google Fonts; their licenses are in `public/fonts/licenses/`.

**Stack:** Vite + vanilla TypeScript · Three.js · `@mediapipe/tasks-vision` · Rapier (`@dimforge/rapier3d-compat`)

## Setup

Requires Node 18+.

```bash
npm install     # also copies the MediaPipe WASM runtime into public/mediapipe/
npm run dev     # → http://localhost:5173
```

Open **http://localhost:5173** and click **Allow camera**. To play without a
camera, click **Use mouse only**.

Other scripts: `npm run build` (typecheck + production build), `npm run preview`,
`npm run typecheck`.

Everything runs locally. The hand model (`public/models/hand_landmarker.task`) is
part of the repo, and the WASM runtime comes from `node_modules`, so no video or
data leaves your machine.

### Camera permission

Browsers only allow camera access in a *secure context*. `http://localhost` counts
as one, but a LAN IP like `http://192.168.x.x` does not, so use `localhost`.

- **Chrome / Edge / Arc:** accept the prompt. If you dismissed it, click the camera
  icon (or the tune icon) in the address bar, set Camera to *Allow*, and reload.
- **Safari:** accept the prompt. If you denied it, go to *Safari → Settings → Websites
  → Camera*, set `localhost` to *Allow*, and reload.
- **macOS:** the browser itself needs camera access too. Enable it in *System
  Settings → Privacy & Security → Camera*, then restart the browser.
- If the camera is "busy", quit other apps that use it (Zoom, FaceTime, Photo Booth).

If the camera is denied or unavailable, the app shows a message explaining what
went wrong, and the mouse fallback keeps working.

## How to play

| Action | Hands | Mouse |
| --- | --- | --- |
| Highlight a letter | move your pinch point (thumb + index) near it | hover it |
| Grab | pinch thumb and index together | press and hold |
| Move | move your hand; move it **toward the screen** to reach deeper into the aisle | drag (the item glides over shelves, counter and basket) |
| Drop / toss | open the pinch, flicking your hand to throw | release, flicking to toss |
| Pass between hands | pinch an item that your other hand is holding | — |

Keys: **R** puts all letters back on their shelves. **D** toggles the debug panel
(FPS, detection time, hands, pinch ratio, hand size, depth). **I** flips the depth
direction (see below).

The HUD counts the letters in the red basket and shows the word they spell.

## How it works

```
src/
  main.ts          boot, start screen, one requestAnimationFrame loop for detection + physics + render
  config.ts        all tuning constants (layout, depth calibration, pinch thresholds, throw)
  scene.ts         Three.js renderer, camera, lights/shadows, floor, walls, shelves, counter, basket
  typefaces.ts     the 12 shelf typefaces: classification, teaching note, letters, colours
  glyphGeometry.ts TTF loading (opentype.js) → extruded glyph geometry + convex-hull points
  products.ts      30 letter products, shelf label strips, highlight helper
  physics.ts       Rapier world, static colliders, convex-hull letter bodies, dynamic ⇄ kinematic switching, reset
  handTracking.ts  webcam permission, HandLandmarker (VIDEO mode, GPU → CPU fallback), mirrored preview
  handMapping.ts   landmarks → 3D hand (projection, depth from hand size, One Euro smoothing)
  gestures.ts      pinch detection with hysteresis
  handVisuals.ts   3D hand (joint spheres + bone cylinders), pinch cursor, floor marker for depth
  interaction.ts   hover, grab, follow, release with velocity, hand-to-hand pass, basket counting
  mouseInput.ts    mouse fallback grabber
  filters.ts       One Euro filter
  ui.ts            overlay, HUD, debug panel
```

- **Mapping:** the x mirror makes your right hand move right on screen. The middle
  knuckle is projected along the virtual camera's view ray. The *depth* along that
  ray comes from the apparent hand size (wrist → middle knuckle). The joints are
  then rebuilt around that anchor at a fixed world scale, so the virtual hand keeps
  its size. A One Euro filter smooths every joint and the depth.
- **Depth direction:** by default a bigger hand (closer to the webcam) reaches
  *deeper* into the aisle, as if you were reaching through the screen like a
  window. Press **I** to invert this, so a bigger hand comes closer to you. To
  calibrate for your own setup, adjust `HAND_MAPPING.sizeFar`, `sizeNear`,
  `distNear` and `distFar` in `src/config.ts`. The debug panel shows the live hand
  size.
- **Pinch:** the thumb–index distance is divided by hand size. A pinch starts
  below 0.32 and only ends above 0.5, so the gap between the two (hysteresis) stops
  the grab from flickering.
- **Grab:** the nearest product within the grab radius of the pinch point lights
  up. While you hold it, its body is *kinematic* and follows your hand, pushing
  other items aside. When you let go it becomes dynamic again and picks up your
  hand's velocity over the last ~100 ms, so you can throw it.
- **Letter physics:** each letter's collider is the convex hull of its glyph, so the
  gaps in letters like L or C act as if they were filled in. On the shelf, letters
  stay upright but can still slide when pushed, because round or slanted bottoms
  (O, S, script and italic forms) would otherwise tip over. Once you grab a letter,
  it tumbles freely.
- **Performance:** detection and rendering share one loop. Detection only runs
  when the video has a new frame. If detection averages more than 18 ms, it runs
  every other frame. Physics uses a fixed 60 Hz step.
