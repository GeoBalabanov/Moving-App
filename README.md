# Virtual Store — grab products with your real hands

A browser-based first-person store aisle. Your Mac's webcam tracks your hands
(MediaPipe HandLandmarker), and you pinch to pick products off the shelves, carry
them, pass them between hands, toss them, and drop them into the basket. You don't
need a VR headset: just a laptop camera.

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
| Highlight an item | move your pinch point (thumb + index) near it | hover it |
| Grab | pinch thumb and index together | press and hold |
| Move | move your hand; move it **toward the screen** to reach deeper into the aisle | drag (the item glides over shelves, counter and basket) |
| Drop / toss | open the pinch, flicking your hand to throw | release, flicking to toss |
| Pass between hands | pinch an item that your other hand is holding | — |

Keys: **R** resets all products to their shelves. **D** toggles the debug panel
(FPS, detection time, hands, pinch ratio, hand size, depth). **I** flips the depth
direction (see below).

The HUD counts the items that are currently in the red basket.

## How it works

```
src/
  main.ts          boot, start screen, one requestAnimationFrame loop for detection + physics + render
  config.ts        all tuning constants (layout, depth calibration, pinch thresholds, throw)
  scene.ts         Three.js renderer, camera, lights/shadows, floor, walls, shelves, counter, basket
  products.ts      30 procedural products (boxes, cans, bottles, jars, fruit) + highlight helper
  physics.ts       Rapier world, static colliders, dynamic ⇄ kinematic switching, reset
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
- **Performance:** detection and rendering share one loop. Detection only runs
  when the video has a new frame. If detection averages more than 18 ms, it runs
  every other frame. Physics uses a fixed 60 Hz step.
