// Product catalogue: simple procedural meshes (boxes, cans, bottles, fruit)
// plus their home slots on the shelves.

import * as THREE from 'three';
import { STORE } from './config';

export type ColliderShape =
  | { type: 'box'; halfExtents: THREE.Vector3 }
  | { type: 'cylinder'; radius: number; halfHeight: number }
  | { type: 'ball'; radius: number };

export interface Product {
  index: number;
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

type Kind = 'cereal' | 'snack' | 'milk' | 'detergent' | 'can' | 'bottle' | 'jar' | 'apple' | 'orange' | 'lemon';

interface Spec {
  name: string;
  kind: Kind;
  color: number;
  accent?: number;
}

// [unit][level] → items on that shelf, left to right.
const LAYOUT: Spec[][][] = [
  [
    [
      { name: 'Sparkle Wash', kind: 'detergent', color: 0x2a7de1, accent: 0xffd23f },
      { name: 'Fresh Wave', kind: 'detergent', color: 0x13a37a, accent: 0xffffff },
    ],
    [
      { name: 'Olive Oil', kind: 'bottle', color: 0x8aa832 },
      { name: 'Cola', kind: 'bottle', color: 0x6b1d12 },
    ],
    [
      { name: 'Choco Puffs', kind: 'cereal', color: 0x6b3d1f, accent: 0xffc93c },
      { name: 'Honey Os', kind: 'cereal', color: 0xf2b134, accent: 0x7a3e00 },
      { name: 'Corn Flakes', kind: 'cereal', color: 0xe24a33, accent: 0xffffff },
    ],
    [
      { name: 'Tomato Soup', kind: 'can', color: 0xd62828, accent: 0xffffff },
      { name: 'Beans', kind: 'can', color: 0x3a86ff, accent: 0xffffff },
      { name: 'Peas', kind: 'can', color: 0x38b000, accent: 0xffffff },
    ],
  ],
  [
    [
      { name: 'Milk', kind: 'milk', color: 0xffffff, accent: 0x1d6fd8 },
      { name: 'Choc Milk', kind: 'milk', color: 0xffffff, accent: 0x6b3d1f },
    ],
    [
      { name: 'Apple', kind: 'apple', color: 0xc1121f },
      { name: 'Green Apple', kind: 'apple', color: 0x7cc22b },
      { name: 'Orange', kind: 'orange', color: 0xff8c1a },
    ],
    [
      { name: 'Sardines', kind: 'can', color: 0x8ecae6, accent: 0x023047 },
      { name: 'Corn', kind: 'can', color: 0xffd60a, accent: 0x2b9348 },
      { name: 'Tuna', kind: 'can', color: 0x219ebc, accent: 0xffffff },
    ],
    [
      { name: 'Water', kind: 'bottle', color: 0x9bd3ff },
      { name: 'Orange Juice', kind: 'bottle', color: 0xff9f1c },
    ],
  ],
  [
    [
      { name: 'Jam', kind: 'jar', color: 0x9d0208, accent: 0xf1f1f1 },
      { name: 'Honey', kind: 'jar', color: 0xf4a300, accent: 0xf1f1f1 },
    ],
    [
      { name: 'Granola', kind: 'cereal', color: 0x9c6644, accent: 0xede0d4 },
      { name: 'Rice Pops', kind: 'cereal', color: 0x4361ee, accent: 0xffffff },
      { name: 'Muesli', kind: 'cereal', color: 0x2d6a4f, accent: 0xffe8d6 },
    ],
    [
      { name: 'Orange', kind: 'orange', color: 0xff8c1a },
      { name: 'Apple', kind: 'apple', color: 0xd00000 },
      { name: 'Lime', kind: 'lemon', color: 0x70e000 },
    ],
    [
      { name: 'Crackers', kind: 'snack', color: 0xfb8500, accent: 0x023047 },
      { name: 'Cookies', kind: 'snack', color: 0x3c096c, accent: 0xffd166 },
    ],
  ],
];

export function createProducts(scene: THREE.Scene): Product[] {
  const products: Product[] = [];
  LAYOUT.forEach((levels, unit) => {
    const ux = STORE.shelfUnitXs[unit];
    levels.forEach((items, level) => {
      const y = STORE.shelfLevels[level];
      const slot = STORE.shelfWidth / items.length;
      items.forEach((spec, i) => {
        const x = ux - STORE.shelfWidth / 2 + slot * (i + 0.5);
        const z = STORE.shelfUnitZ + 0.03;
        const product = buildProduct(spec, products.length);
        const halfHeight = productHalfHeight(product.shape);
        product.homePosition.set(x, y + halfHeight + 0.002, z);
        product.object.position.copy(product.homePosition);
        scene.add(product.object);
        products.push(product);
      });
    });
  });
  return products;
}

function productHalfHeight(shape: ColliderShape): number {
  switch (shape.type) {
    case 'box':
      return shape.halfExtents.y;
    case 'cylinder':
      return shape.halfHeight;
    case 'ball':
      return shape.radius;
  }
}

function std(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
}

function buildProduct(spec: Spec, index: number): Product {
  const group = new THREE.Group();
  group.name = spec.name;
  const materials: THREE.MeshStandardMaterial[] = [];
  let shape: ColliderShape;
  let density = 400;

  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[], y = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    materials.push(...(Array.isArray(mat) ? mat : [mat]));
    return mesh;
  };

  const boxProduct = (w: number, h: number, d: number) => {
    const side = std(spec.color);
    const front = std(0xffffff, { map: makeLabel(spec.name, spec.color, spec.accent ?? 0xffffff, w / h) });
    // Box face order: +x, -x, +y, -y, +z (front, facing the shopper), -z.
    addMesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, front, side]);
    shape = { type: 'box', halfExtents: new THREE.Vector3(w / 2, h / 2, d / 2) };
  };

  switch (spec.kind) {
    case 'cereal':
      boxProduct(0.2, 0.3, 0.07);
      density = 200;
      break;
    case 'snack':
      boxProduct(0.22, 0.12, 0.1);
      density = 250;
      break;
    case 'detergent':
      boxProduct(0.26, 0.3, 0.14);
      density = 500;
      break;
    case 'milk': {
      const w = 0.09;
      const h = 0.2;
      boxProduct(w, h, w);
      // Gable top (visual only).
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.0001, w * 0.71, 0.05, 4, 1), std(spec.accent ?? 0x1d6fd8));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h / 2 + 0.025;
      roof.castShadow = true;
      group.add(roof);
      materials.push(roof.material as THREE.MeshStandardMaterial);
      shape = { type: 'box', halfExtents: new THREE.Vector3(w / 2, h / 2, w / 2) };
      density = 900;
      break;
    }
    case 'can': {
      const r = 0.042;
      const h = 0.12;
      const label = std(0xffffff, { map: makeLabel(spec.name, spec.color, spec.accent ?? 0xffffff, (2 * Math.PI * r) / h / 2), roughness: 0.4 });
      const metal = std(0xc8ccd2, { metalness: 0.8, roughness: 0.3 });
      // Cylinder groups: side, top, bottom.
      addMesh(new THREE.CylinderGeometry(r, r, h, 24), [label, metal, metal]);
      shape = { type: 'cylinder', radius: r, halfHeight: h / 2 };
      density = 900;
      break;
    }
    case 'bottle': {
      const r = 0.045;
      const body = 0.2;
      const neck = 0.08;
      const glass = std(spec.color, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
      const half = (body + neck + 0.02) / 2;
      addMesh(new THREE.CylinderGeometry(r, r, body, 24), glass, -half + body / 2);
      addMesh(new THREE.CylinderGeometry(r * 0.35, r, neck, 24), glass, -half + body + neck / 2);
      addMesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, 0.02, 16), std(0xf5f5f5), half - 0.01);
      shape = { type: 'cylinder', radius: r, halfHeight: half };
      density = 700;
      break;
    }
    case 'jar': {
      const r = 0.05;
      const h = 0.11;
      addMesh(new THREE.CylinderGeometry(r, r, h, 24), std(spec.color, { roughness: 0.2 }), -0.01);
      addMesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.02, 24), std(spec.accent ?? 0xf1f1f1, { metalness: 0.5 }), h / 2);
      shape = { type: 'cylinder', radius: r, halfHeight: (h + 0.02) / 2 };
      density = 900;
      break;
    }
    case 'apple':
    case 'orange':
    case 'lemon': {
      const r = spec.kind === 'orange' ? 0.048 : spec.kind === 'lemon' ? 0.038 : 0.044;
      const geo = new THREE.SphereGeometry(r, 24, 16);
      if (spec.kind === 'lemon') geo.scale(1, 0.85, 1.25);
      addMesh(geo, std(spec.color, { roughness: spec.kind === 'apple' ? 0.35 : 0.75 }));
      if (spec.kind === 'apple') {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.025, 6), std(0x5a3a1a));
        stem.position.y = r + 0.008;
        group.add(stem);
      }
      shape = { type: 'ball', radius: r };
      density = 800;
      break;
    }
  }

  const boundingRadius = (() => {
    switch (shape!.type) {
      case 'box':
        return shape!.halfExtents.length();
      case 'cylinder':
        return Math.hypot(shape!.radius, shape!.halfHeight);
      case 'ball':
        return shape!.radius;
    }
  })();

  group.userData.productIndex = index;
  group.traverse((o) => (o.userData.productIndex = index));

  return {
    index,
    name: spec.name,
    object: group,
    shape: shape!,
    boundingRadius,
    density,
    homePosition: new THREE.Vector3(),
    homeQuaternion: new THREE.Quaternion(),
    materials,
  };
}

const labelCache = new Map<string, THREE.Texture>();

/** Draws a simple product label: coloured background, accent band and the name. */
function makeLabel(text: string, bg: number, accent: number, aspect: number): THREE.Texture {
  const key = `${text}|${bg}|${accent}|${aspect.toFixed(2)}`;
  const cached = labelCache.get(key);
  if (cached) return cached;

  const h = 256;
  const w = Math.max(64, Math.round(h * aspect));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, w, h);
  g.fillStyle = hex(accent);
  g.fillRect(0, h * 0.38, w, h * 0.26);
  g.fillStyle = hex(bg);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = Math.round(h * 0.14);
  g.font = `bold ${size}px sans-serif`;
  while (g.measureText(text).width > w * 0.9 && size > 10) {
    size -= 2;
    g.font = `bold ${size}px sans-serif`;
  }
  g.fillText(text, w / 2, h * 0.51);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  labelCache.set(key, tex);
  return tex;
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
