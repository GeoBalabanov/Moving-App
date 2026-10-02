// Entry point: wires the scene, physics, hand tracking, interaction and UI
// together and runs a single animation loop for detection + rendering.

import * as THREE from 'three';
import { HAND_MAPPING } from './config';
import type { Grabber } from './grabber';
import { TrackedHand, depthCalibration } from './handMapping';
import { CameraError, HandTracker, PreviewRenderer, startWebcam, type Handedness } from './handTracking';
import { HandVisual } from './handVisuals';
import { Interaction } from './interaction';
import { MouseGrabber } from './mouseInput';
import { Physics } from './physics';
import { createProducts, cssFamily } from './products';
import { createStoreScene } from './scene';
import { UI } from './ui';

async function main(): Promise<void> {
  const ui = new UI({
    onCamera: () => void enableCamera(),
    onMouseOnly: () => {
      ui.hideOverlay();
      ui.setHint('Mouse mode: drag letters onto shelves or the basket · flick to toss · R reset · D debug');
    },
    onReset: () => reset(),
    onToggleDebug: () => ui.toggleDebug(),
  });

  // --- 3D store + physics -------------------------------------------------------
  const store = createStoreScene(ui.sceneCanvas);
  const products = await createProducts(store.scene);
  const physics = new Physics(products);
  await physics.init(store.staticBoxes);
  const interaction = new Interaction(products, physics, store.basket);

  // --- Inputs -------------------------------------------------------------------
  const hands: Record<Handedness, TrackedHand> = { Left: new TrackedHand('Left'), Right: new TrackedHand('Right') };
  const productObjects = new Set(products.map((p) => p.object));
  const surfaces = store.scene.children.filter((o) => o instanceof THREE.Mesh && !productObjects.has(o));
  const handVisuals = [new HandVisual(hands.Left, store.scene, surfaces), new HandVisual(hands.Right, store.scene, surfaces)];
  const mouse = new MouseGrabber(ui.sceneCanvas, store.camera, products, surfaces);
  const grabbers: Grabber[] = [hands.Left, hands.Right, mouse];

  const tracker = new HandTracker(ui.video);
  const preview = new PreviewRenderer(ui.previewCanvas, ui.video);
  let cameraRunning = false;

  async function enableCamera(): Promise<void> {
    ui.setCameraButton('Starting camera…', true);
    try {
      await startWebcam(ui.video);
      cameraRunning = true;
      ui.showPreview();
      ui.hideOverlay();
      ui.setPreviewStatus('Loading hand model…');
      await tracker.init();
      ui.setPreviewStatus('Show your hands to the camera');
    } catch (err) {
      console.error(err);
      cameraRunning = false;
      const msg = err instanceof CameraError ? err.message : `Hand tracking failed to start: ${(err as Error).message}`;
      ui.setCameraButton('Try again', false);
      ui.showError(`${msg} You can still use the mouse to grab items.`);
      document.getElementById('overlay')!.classList.remove('hidden');
    }
  }

  function reset(): void {
    interaction.releaseAll();
    physics.resetAll();
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    switch (e.key.toLowerCase()) {
      case 'd':
        ui.toggleDebug();
        break;
      case 'r':
        reset();
        break;
      case 'i':
        HAND_MAPPING.reachIn = !HAND_MAPPING.reachIn;
        break;
    }
  });

  // --- Main loop --------------------------------------------------------------------
  let lastTime = performance.now();
  let fps = 0;
  let frames = 0;
  let fpsWindowStart = lastTime;
  let lastDebugUpdate = 0;

  const loop = (now: number) => {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    frames++;
    if (now - fpsWindowStart >= 500) {
      fps = (frames * 1000) / (now - fpsWindowStart);
      frames = 0;
      fpsWindowStart = now;
    }

    // 1. Hand tracking (may skip frames when detection is slow).
    if (cameraRunning && tracker.ready && tracker.update(now)) {
      const aspect = ui.video.videoWidth / ui.video.videoHeight;
      const seen = new Set<Handedness>();
      for (const detected of tracker.latest) {
        hands[detected.handedness].update(detected, aspect, store.camera, now);
        seen.add(detected.handedness);
      }
      for (const h of [hands.Left, hands.Right]) if (!seen.has(h.handedness)) h.markMissing(now);
    }
    mouse.update(interaction.heldIndex(mouse.id));

    // 2. Grabbing, then physics.
    interaction.update(grabbers, now);
    physics.update(dt);

    // 3. Visuals.
    for (const v of handVisuals) v.update();
    if (cameraRunning) {
      preview.draw(tracker.latest, { Left: hands.Left.pinching, Right: hands.Right.pinching });
      if (tracker.ready) {
        const n = tracker.latest.length;
        ui.setPreviewStatus(n === 0 ? 'No hands detected' : `${n} hand${n > 1 ? 's' : ''} detected`);
      }
    }
    ui.setBasketCount(interaction.basketCount);
    ui.setBasketWord(
      interaction.basketIndices.map((i) => ({ glyph: products[i].glyph, fontFamily: cssFamily(products[i].typeface) })),
    );
    const focus = interaction.focusIndex();
    if (focus === null) ui.setTypeCard(null);
    else {
      const { glyph, typeface } = products[focus];
      ui.setTypeCard({ glyph, fontFamily: cssFamily(typeface), ...typeface });
    }
    store.renderer.render(store.scene, store.camera);

    if (ui.debugVisible && now - lastDebugUpdate > 150) {
      lastDebugUpdate = now;
      ui.setDebug(debugText());
    }
    requestAnimationFrame(loop);
  };

  function debugText(): string {
    const lines = [
      `FPS            ${fps.toFixed(0)}`,
      `physics steps  ${physics.lastSteps}/frame`,
      `camera         ${cameraRunning ? (tracker.ready ? 'tracking' : 'loading model') : 'off'}`,
      `detect         ${tracker.detectMs.toFixed(1)} ms · ${tracker.detectFps.toFixed(0)} Hz`,
      `hands detected ${tracker.latest.length}`,
      `depth mapping  ${HAND_MAPPING.reachIn ? 'reach-in' : 'mirror'} (I to toggle)`,
      `size range     ${depthCalibration.min.toFixed(3)} – ${depthCalibration.max.toFixed(3)} (auto)`,
    ];
    for (const h of [hands.Left, hands.Right]) {
      lines.push('');
      if (!h.active) {
        lines.push(`${h.handedness.padEnd(5)}  —`);
        continue;
      }
      const held = interaction.heldIndex(h.id);
      lines.push(
        `${h.handedness.padEnd(5)}  pinch ${h.pinch.ratio.toFixed(2)} ${h.pinching ? 'GRAB' : 'open'}`,
        `       size ${h.size.toFixed(3)}  depth ${h.depth.toFixed(2)} m`,
        `       pos ${fmt(h.point)}`,
        `       holding ${held === null ? '—' : products[held].name}`,
      );
    }
    const mouseHeld = interaction.heldIndex(mouse.id);
    lines.push('', `Mouse  ${mouse.pinching ? 'down' : 'up'}  holding ${mouseHeld === null ? '—' : products[mouseHeld].name}`);
    return lines.join('\n');
  }

  requestAnimationFrame(loop);

  // Handy for poking at things from the devtools console.
  Object.assign(window, { store: { scene: store.scene, camera: store.camera, products, physics, interaction, hands, mouse, reset, depthCalibration } });
}

const fmt = (v: THREE.Vector3) => `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div style="position:fixed;inset:auto 16px 16px 16px;padding:12px;background:#a33;color:#fff;border-radius:8px;font:14px sans-serif">Failed to start: ${String(err?.message ?? err)}</div>`,
  );
});
