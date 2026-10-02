// Product catalogue: extruded 3D letters, one typeface per shelf, plus a
// shelf label naming the typeface and its classification.

import * as THREE from 'three';
import { STORE } from './config';
import { glyphGeometry, hullPoints, loadFont, registerCssFont } from './glyphGeometry';
import { SHELF_TYPEFACES, type Typeface } from './typefaces';

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
const CAP_HEIGHT = 0.24;
const LETTER_DEPTH = 0.06;

export async function createProducts(scene: THREE.Scene): Promise<Product[]> {
  const all = SHELF_TYPEFACES.flat();
  const fonts = new Map(await Promise.all(all.map(async (tf) => [tf.file, await loadFont(tf.file)] as const)));
  // Fonts for the 2D shelf labels; a failure only affects label styling.
  await Promise.all(all.map((tf) => registerCssFont(cssFamily(tf), tf.file).catch((e) => console.warn(e))));

  const products: Product[] = [];
  SHELF_TYPEFACES.forEach((rows, unit) => {
    const ux = STORE.shelfUnitXs[unit];
    rows.forEach((typeface, row) => {
      // Rows are listed top-down; shelf levels are bottom-up.
      const levelIndex = STORE.shelfLevels.length - 1 - row;
      const y = STORE.shelfLevels[levelIndex];
      addShelfLabel(scene, typeface, ux, y);

      const font = fonts.get(typeface.file)!;
      const slot = STORE.shelfWidth / typeface.letters.length;
      typeface.letters.forEach((glyph, i) => {
        const color = typeface.colors[i % typeface.colors.length];
        const product = buildLetter(glyph, typeface, font, color, products.length);
        const x = ux - STORE.shelfWidth / 2 + slot * (i + 0.5);
        // Near the front edge so the label strip of the shelf above doesn't hide the letter.
        product.homePosition.set(x, y + product.shape.halfExtents.y + 0.002, STORE.shelfUnitZ + 0.1);
        product.object.position.copy(product.homePosition);
        scene.add(product.object);
        products.push(product);
      });
    });
  });
  return products;
}

export const cssFamily = (tf: Typeface) => `shelf-${tf.file.replace(/\W/g, '')}`;

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

/** A label strip on the shelf's front edge: classification + typeface, set in that typeface. */
function addShelfLabel(scene: THREE.Scene, tf: Typeface, x: number, levelY: number): void {
  const w = 1024;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf8f1';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1d1d1d';
  g.textBaseline = 'middle';
  g.font = `600 26px -apple-system, "Helvetica Neue", sans-serif`;
  g.fillText(tf.classification.toUpperCase(), 24, h / 2 + 2);
  g.textAlign = 'right';
  g.font = `38px "${cssFamily(tf)}", serif`;
  g.fillText(tf.name, w - 24, h / 2 + 4);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const labelW = STORE.shelfWidth * 0.96;
  const labelH = (labelW * h) / w;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(labelW, labelH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  // Hangs just below the front edge of the board, like a price strip.
  label.position.set(x, levelY - STORE.boardThickness - labelH / 2, STORE.shelfUnitZ + STORE.shelfDepth / 2 + 0.002);
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
