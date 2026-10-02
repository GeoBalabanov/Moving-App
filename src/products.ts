// Product catalogue: extruded 3D letters, one typeface per shelf, plus a
// shelf label naming the typeface and its classification.

import * as THREE from 'three';
import type { Font } from 'opentype.js';
import type { TypeShelf } from './aisle';
import { AISLE } from './config';
import { fontFamilyFor, glyphGeometry, hullPoints, loadFont, registerCssFont } from './glyphGeometry';
import { ALL_TYPEFACES, type Typeface } from './typefaces';

export type ColliderShape =
  | { type: 'box'; halfExtents: THREE.Vector3 }
  | { type: 'convex'; points: Float32Array; halfExtents: THREE.Vector3 };

export interface Product {
  index: number;
  /** The character, e.g. "A" or "&". */
  glyph: string;
  typeface: Typeface;
  name: string;
  object: THREE.Object3D;
  shape: ColliderShape;
  /** Radius of a sphere enclosing the product (for grab distance checks). */
  boundingRadius: number;
  density: number;
  homePosition: THREE.Vector3;
  homeQuaternion: THREE.Quaternion;
  materials: THREE.MeshStandardMaterial[];
}

/** Cap height of every letter: all typefaces are "set" at the same size. */
const CAP_HEIGHT = 0.26;
const LETTER_DEPTH = 0.06;
/** How far (radians) letters turn from facing the aisle towards the shopper. */
const FACE_TURN = 0.5;

/** Loads every class typeface: outlines for the 3D letters, CSS faces for labels/packaging/HUD. */
export async function loadTypefaceFonts(): Promise<Map<string, Font>> {
  const files = [...new Set(ALL_TYPEFACES.map((tf) => tf.file))];
  // A CSS registration failure only affects 2D text styling, so it just warns.
  await Promise.all(files.map((f) => registerCssFont(f).catch((e) => console.warn(e))));
  return new Map(await Promise.all(files.map(async (f) => [f, await loadFont(f)] as const)));
}

export function createProducts(scene: THREE.Scene, shelves: TypeShelf[], fonts: Map<string, Font>): Product[] {
  const products: Product[] = [];
  for (const shelf of shelves) {
    const { typeface, side, z0, z1, y } = shelf;
    addShelfLabel(scene, shelf);
    const font = fonts.get(typeface.file)!;
    const slot = (z0 - z1) / typeface.letters.length;
    typeface.letters.forEach((glyph, i) => {
      const color = typeface.colors[i % typeface.colors.length];
      const product = buildLetter(glyph, typeface, font, color, products.length);
      const x = side * (AISLE.frontX + 0.14);
      const z = z0 - slot * (i + 0.5);
      product.homePosition.set(x, y + product.shape.halfExtents.y + 0.002, z);
      // Face into the aisle like the other products, angled a little towards the shopper.
      const yaw = side < 0 ? Math.PI / 2 - FACE_TURN : -Math.PI / 2 + FACE_TURN;
      product.homeQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      product.object.position.copy(product.homePosition);
      product.object.quaternion.copy(product.homeQuaternion);
      scene.add(product.object);
      products.push(product);
    });
  }
  return products;
}

export const cssFamily = (tf: Typeface) => fontFamilyFor(tf.file);

function buildLetter(
  glyph: string,
  typeface: Typeface,
  font: Awaited<ReturnType<typeof loadFont>>,
  color: number,
  index: number,
): Product {
  const { geometry, size } = glyphGeometry(font, glyph, CAP_HEIGHT, LETTER_DEPTH);
  // ExtrudeGeometry groups: 0 = front/back faces, 1 = sides.
  const face = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 });
  const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.5 });
  const mesh = new THREE.Mesh(geometry, [face, side]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.name = `${glyph} (${typeface.name})`;
  group.add(mesh);
  group.userData.productIndex = index;
  mesh.userData.productIndex = index;

  const halfExtents = size.clone().multiplyScalar(0.5);
  return {
    index,
    glyph,
    typeface,
    name: `“${glyph}” · ${typeface.name}`,
    object: group,
    shape: { type: 'convex', points: hullPoints(geometry), halfExtents },
    boundingRadius: halfExtents.length(),
    density: 500,
    homePosition: new THREE.Vector3(),
    homeQuaternion: new THREE.Quaternion(),
    materials: [face, side],
  };
}

/** A label strip on the shelf's front rail: classification + typeface, set in that typeface. */
function addShelfLabel(scene: THREE.Scene, shelf: TypeShelf): void {
  const { typeface: tf, side, z0, z1, y } = shelf;
  const w = 1024;
  const h = 56;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf8f1';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f6f50';
  g.fillRect(0, 0, 10, h);
  g.fillStyle = '#1d1d1d';
  g.textBaseline = 'middle';
  g.font = `600 22px -apple-system, "Helvetica Neue", sans-serif`;
  g.fillText(tf.classification.toUpperCase(), 24, h / 2 + 1);
  g.textAlign = 'right';
  g.font = `34px "${cssFamily(tf)}", serif`;
  g.fillText(tf.name, w - 18, h / 2 + 3);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  const len = (z0 - z1) * 0.98;
  const labelH = (len * h) / w;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(len, labelH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  // On the rail just below the board, facing into the aisle.
  label.position.set(side * (AISLE.frontX - 0.004), y - AISLE.board - labelH / 2 + 0.02, (z0 + z1) / 2);
  label.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(label);
}

/** Hover/hold feedback via emissive glow. */
export function setHighlight(product: Product, color: THREE.Color | null, intensity = 0.35): void {
  for (const m of product.materials) {
    if (color) {
      m.emissive.copy(color);
      m.emissiveIntensity = intensity;
    } else {
      m.emissive.setRGB(0, 0, 0);
      m.emissiveIntensity = 0;
    }
  }
}
