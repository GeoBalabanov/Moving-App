// Grocery brands for the aisle shelves. Every brand name is set in one of the
// class typefaces, so the packaging doubles as type specimens. Textures are
// drawn on canvases (fonts must be registered first, see registerCssFont).

import * as THREE from 'three';
import { fontFamilyFor } from './glyphGeometry';

export type PackShape = 'box' | 'bottle';

export interface Brand {
  name: string;
  shape: PackShape;
  /** Width (along the shelf), height and depth in metres. */
  size: [number, number, number];
  bg: string;
  fg: string;
  accent: string;
  font: string;
}

const F = {
  archivo: 'ArchivoBlack-Regular.ttf',
  lobster: 'Lobster-Regular.ttf',
  poppins: 'Poppins-Bold.ttf',
  abril: 'AbrilFatface-Regular.ttf',
  arvo: 'Arvo-Bold.ttf',
  bebas: 'BebasNeue-Regular.ttf',
  goudy: 'SortsMillGoudy-Regular.ttf',
  oldstd: 'OldStandard-Bold.ttf',
  alfa: 'AlfaSlabOne-Regular.ttf',
  fira: 'FiraSans-Bold.ttf',
  mono: 'SpaceMono-Bold.ttf',
  fraktur: 'UnifrakturMaguntia-Book.ttf',
};

export const BRANDS: Brand[] = [
  { name: 'Fruit', shape: 'box', size: [0.2, 0.28, 0.07], bg: '#27b04a', fg: '#ffe14d', accent: '#e63946', font: F.archivo },
  { name: 'Choco', shape: 'box', size: [0.22, 0.2, 0.08], bg: '#f28ad3', fg: '#6b2f12', accent: '#ffffff', font: F.lobster },
  { name: 'Cookies', shape: 'box', size: [0.22, 0.16, 0.1], bg: '#2f9bff', fg: '#ffffff', accent: '#ffb703', font: F.poppins },
  { name: 'Orange', shape: 'box', size: [0.24, 0.3, 0.1], bg: '#ff8c1a', fg: '#ffffff', accent: '#ffd166', font: F.lobster },
  { name: 'Grape', shape: 'box', size: [0.2, 0.24, 0.12], bg: '#7b2cbf', fg: '#ffffff', accent: '#c77dff', font: F.abril },
  { name: 'Oats', shape: 'box', size: [0.19, 0.29, 0.07], bg: '#f4c542', fg: '#7a3e00', accent: '#ffffff', font: F.arvo },
  { name: 'CRACKERS', shape: 'box', size: [0.25, 0.14, 0.12], bg: '#e63946', fg: '#ffffff', accent: '#ffd166', font: F.bebas },
  { name: 'Tea', shape: 'box', size: [0.16, 0.1, 0.09], bg: '#2a9d8f', fg: '#ffffff', accent: '#e9c46a', font: F.goudy },
  { name: 'Pasta', shape: 'box', size: [0.12, 0.26, 0.07], bg: '#1d3557', fg: '#ffd166', accent: '#e63946', font: F.oldstd },
  { name: 'Rice', shape: 'box', size: [0.15, 0.22, 0.08], bg: '#f1faee', fg: '#d62828', accent: '#457b9d', font: F.alfa },
  { name: 'Soap', shape: 'box', size: [0.18, 0.12, 0.08], bg: '#a8dadc', fg: '#1d3557', accent: '#ffffff', font: F.fira },
  { name: 'COFFEE', shape: 'box', size: [0.14, 0.24, 0.09], bg: '#4a2c2a', fg: '#f4e1c1', accent: '#c08552', font: F.mono },
  { name: 'Bier', shape: 'box', size: [0.26, 0.18, 0.17], bg: '#f6e7c1', fg: '#7a1e1e', accent: '#c9a227', font: F.fraktur },
  { name: 'Cola', shape: 'bottle', size: [0.09, 0.32, 0.09], bg: '#c1121f', fg: '#ffffff', accent: '#3a0a0a', font: F.lobster },
  { name: 'Lemon', shape: 'bottle', size: [0.09, 0.3, 0.09], bg: '#ffe14d', fg: '#2b7a0b', accent: '#f9f871', font: F.bebas },
  { name: 'Grape', shape: 'bottle', size: [0.1, 0.32, 0.1], bg: '#7b2cbf', fg: '#ffffff', accent: '#3c096c', font: F.abril },
  { name: 'Orange', shape: 'bottle', size: [0.09, 0.3, 0.09], bg: '#ff8c1a', fg: '#ffffff', accent: '#ff6d00', font: F.poppins },
  { name: 'Lime', shape: 'bottle', size: [0.09, 0.3, 0.09], bg: '#38b000', fg: '#ffffff', accent: '#2d6a4f', font: F.archivo },
  { name: 'Water', shape: 'bottle', size: [0.09, 0.3, 0.09], bg: '#8ecae6', fg: '#023047', accent: '#bde0fe', font: F.fira },
];

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function fitText(g: CanvasRenderingContext2D, text: string, family: string, maxW: number, maxH: number): void {
  let size = maxH;
  g.font = `${size}px "${family}", sans-serif`;
  while (g.measureText(text).width > maxW && size > 8) {
    size -= 2;
    g.font = `${size}px "${family}", sans-serif`;
  }
}

/** Front panel of a box: the brand set big, with a little "product art" and a flash. */
export function brandFrontTexture(b: Brand): THREE.CanvasTexture {
  const w = 256;
  const h = Math.round((256 * b.size[1]) / b.size[0]);
  const [c, g] = canvas(w, h);
  g.fillStyle = b.bg;
  g.fillRect(0, 0, w, h);
  // Product art: a few circles at the bottom.
  g.fillStyle = b.accent;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(w * (0.3 + i * 0.2), h * 0.78, Math.min(w, h) * 0.12, 0, Math.PI * 2);
    g.fill();
  }
  // Brand name with a dark outline, like real packaging.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, b.name, fontFamilyFor(b.font), w * 0.88, Math.min(h * 0.32, 110));
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.strokeText(b.name, w / 2, h * 0.4);
  g.fillStyle = b.fg;
  g.fillText(b.name, w / 2, h * 0.4);
  // Small band at the top.
  g.fillStyle = b.accent;
  g.fillRect(0, 0, w, h * 0.08);
  return tex(c);
}

/** Plain side panels: brand colour with a stripe. */
export function brandSideTexture(b: Brand): THREE.CanvasTexture {
  const [c, g] = canvas(64, 128);
  g.fillStyle = b.bg;
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = b.accent;
  g.fillRect(0, 0, 64, 10);
  g.fillRect(0, 100, 64, 6);
  return tex(c);
}

/**
 * Bottle wrap (u = around, v = up the profile, see bottleGeometry): coloured
 * plastic, a label band with the name (twice, so it shows from the front) and a cap.
 */
export function bottleTexture(b: Brand): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const [c, g] = canvas(w, h);
  g.fillStyle = b.bg;
  g.fillRect(0, 0, w, h);
  // Canvas y is flipped relative to v: v = 1 - y / h.
  const band = (v0: number, v1: number) => [h * (1 - v1), h * (v1 - v0)] as const;
  const [ly, lh] = band(0.16, 0.5);
  g.fillStyle = '#ffffff';
  g.fillRect(0, ly, w, lh);
  g.fillStyle = b.accent;
  g.fillRect(0, ly, w, 6);
  g.fillRect(0, ly + lh - 6, w, 6);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, b.name, fontFamilyFor(b.font), w * 0.4, lh * 0.8);
  g.fillStyle = b.bg === '#ffe14d' ? b.fg : b.bg;
  // u = 0.25 faces +x before rotation; draw the name at two opposite points.
  for (const u of [0.25, 0.75]) g.fillText(b.name, w * u, ly + lh / 2 + 2);
  const [cy, ch] = band(0.88, 1.0);
  g.fillStyle = '#f5f5f5';
  g.fillRect(0, cy, w, ch);
  return tex(c);
}

/** Lathe profile for a soft-drink bottle of unit height (scaled per brand). */
export function bottleGeometry(): THREE.LatheGeometry {
  const r = 0.5;
  const pts = [
    [0, 0],
    [r * 0.9, 0],
    [r, 0.04],
    [r, 0.2],
    [r, 0.35],
    [r, 0.5],
    [r, 0.6],
    [r * 0.75, 0.72],
    [r * 0.38, 0.84],
    [r * 0.36, 0.88],
    [r * 0.4, 0.9],
    [r * 0.4, 1.0],
    [0, 1.0],
  ].map(([x, y]) => new THREE.Vector2(x, y - 0.5));
  const geo = new THREE.LatheGeometry(pts, 24);
  // Remap v so it follows the profile index (the bottleTexture bands assume this).
  return geo;
}

/** Shelf price tag. */
export function priceTagTexture(price: string): THREE.CanvasTexture {
  const [c, g] = canvas(160, 100);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 160, 100);
  g.fillStyle = '#d62828';
  g.fillRect(0, 0, 160, 26);
  g.fillStyle = '#ffffff';
  g.font = 'bold 18px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SPECIAL', 80, 14);
  g.fillStyle = '#111111';
  g.font = 'bold 44px "Helvetica Neue", Arial, sans-serif';
  g.fillText(price, 80, 64);
  return tex(c);
}

/** "SAVE 10%" shelf talker. */
export function saveSignTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(200, 260);
  g.fillStyle = '#d90429';
  g.fillRect(0, 0, 200, 260);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 54px "Helvetica Neue", Arial, sans-serif';
  g.fillText('SAVE', 100, 50);
  g.beginPath();
  g.arc(100, 160, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d90429';
  g.font = 'bold 50px "Helvetica Neue", Arial, sans-serif';
  g.fillText('10%', 100, 162);
  return tex(c);
}

/** Brown shipping carton for overstock on top of the shelves. */
export function cartonTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#b5895a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#c99b68';
  g.fillRect(0, 56, 128, 16);
  g.strokeStyle = '#5c4026';
  g.lineWidth = 3;
  g.strokeRect(30, 20, 68, 28);
  g.fillStyle = '#5c4026';
  g.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('THIS SIDE UP', 64, 40);
  return tex(c);
}
