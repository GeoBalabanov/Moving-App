// Procedural canvas textures for the store (no image files needed).

import * as THREE from 'three';

function canvasTexture(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Deterministic PRNG so the store looks the same on every load. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One 50 cm polished beige floor tile with subtle speckle and grout (repeat it). */
export function makeTileTexture(): THREE.CanvasTexture {
  const n = 512;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8cbb2';
  g.fillRect(0, 0, n, n);
  const rand = seededRandom(7);
  for (let i = 0; i < 2600; i++) {
    const v = 150 + Math.floor(rand() * 70);
    g.fillStyle = `rgba(${v},${v - 8},${v - 22},0.3)`;
    g.fillRect(rand() * n, rand() * n, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
  g.strokeStyle = 'rgba(120,115,105,0.45)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, n, n);
  return canvasTexture(c, true);
}

/** White pegboard for shelf backs (one 50 cm panel; repeat it). */
export function makePegboardTexture(): THREE.CanvasTexture {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.fillStyle = '#eef0f1';
  g.fillRect(0, 0, n, n);
  g.fillStyle = '#b9bfc4';
  const step = n / 10;
  for (let y = step / 2; y < n; y += step) {
    for (let x = step / 2; x < n; x += step) {
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  return canvasTexture(c, true);
}

/** A flat sign: background colour + centred text. */
export function makeLabelTexture(text: string, bg: string, fg: string, w: number, h: number, font: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + h * 0.03, w * 0.92);
  return canvasTexture(c);
}

/** Shopping-cart wire grid: one cell with transparent holes (use alphaTest, repeat it). */
export function makeWireTexture(): THREE.CanvasTexture {
  const n = 32;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, n, n);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, n, 4);
  g.fillRect(0, 0, 4, n);
  return canvasTexture(c, true);
}
