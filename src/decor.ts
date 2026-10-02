// Store dressing: the stocked gondolas that form your aisle, more aisles
// behind the display, a wall of coolers, ceiling light panels and hanging
// aisle signs. All of it is static; only the gondolas get (simple) colliders.

import * as THREE from 'three';
import { AISLE, ROOM } from './config';
import type { AddBox } from './scene';
import { makeLabelTexture, makePackagingTexture, makePegboardTexture, seededRandom } from './textures';

const LEVELS = [0.13, 0.48, 0.83, 1.18, 1.53];
const TOP = 1.9;
const BOARD = 0.025;

const PALETTE = [
  0xd62828, 0xf77f00, 0xfcbf49, 0x2a9d8f, 0x264653, 0x3a86ff, 0x8338ec, 0xff006e, 0x06d6a0, 0x118ab2, 0x073b4c, 0xef476f,
  0xffd166, 0x8ac926, 0x6a4c93, 0xe63946, 0x1d3557, 0x457b9d, 0xf4a261, 0xe9c46a, 0xffffff, 0x2b2d42, 0xbc6c25, 0x588157,
];

interface Item {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotY: number;
  color: number;
}

export function buildStoreDecor(scene: THREE.Scene, addBox: AddBox): void {
  // Decor lives in a group so it isn't used as a raycast surface for hands / mouse.
  const decor = new THREE.Group();
  decor.name = 'decor';
  scene.add(decor);
  const rand = seededRandom(42);

  const boxes: Item[] = [];
  const cans: Item[] = [];

  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.4, metalness: 0.15 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xd9dde1, roughness: 0.35, metalness: 0.45 });
  const kickMat = new THREE.MeshStandardMaterial({ color: 0x2f3a45, roughness: 0.5, metalness: 0.3 });
  const stripMat = new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.6 });
  const peg = makePegboardTexture();
  peg.repeat.set(10, 4);
  const backMat = new THREE.MeshStandardMaterial({ map: peg, roughness: 0.6 });
  const headerMat = new THREE.MeshStandardMaterial({ color: 0x1f6f50, roughness: 0.5 });

  const visual = (center: THREE.Vector3, size: THREE.Vector3, mat: THREE.Material, cast = false) =>
    addBox(center, size, mat, { collide: false, cast, receive: true, parent: decor });

  /** Fill one shelf run with rows of repeated products ("facings"). */
  const stockRun = (from: number, to: number, along: 'x' | 'z', fixed: number, y: number, depth: number, maxH: number, facing: number) => {
    let p = from + 0.03;
    while (p < to - 0.08) {
      const isCan = rand() < 0.28;
      const color = PALETTE[Math.floor(rand() * PALETTE.length)];
      const w = isCan ? 0.07 + rand() * 0.04 : 0.08 + rand() * 0.16;
      const h = Math.min(maxH, isCan ? 0.1 + rand() * 0.14 : 0.12 + rand() * 0.2);
      const d = Math.min(depth * 0.85, isCan ? w : 0.06 + rand() * 0.2);
      const facings = 1 + Math.floor(rand() * 5);
      for (let i = 0; i < facings && p + w < to - 0.03; i++) {
        const c = p + w / 2;
        // The product's front (+z in its own frame) faces the aisle.
        const offset = (depth - d) / 2 - 0.02;
        const item: Item =
          along === 'z'
            ? { x: fixed - facing * offset, y: y + h / 2, z: c, sx: w, sy: h, sz: d, rotY: (facing * Math.PI) / 2, color }
            : { x: c, y: y + h / 2, z: fixed - facing * offset, sx: w, sy: h, sz: d, rotY: facing > 0 ? 0 : Math.PI, color };
        (isCan ? cans : boxes).push(item);
        p += w + 0.012;
      }
      p += 0.02;
    }
  };

  /**
   * A gondola running along z. `faces` lists which sides have shelves (+1 = facing +x).
   * Single-sided gondolas have their back on the side away from the face.
   */
  const gondolaZ = (x: number, z0: number, z1: number, depth: number, faces: number[], collide: boolean) => {
    const len = z1 - z0;
    const cz = (z0 + z1) / 2;
    const double = faces.length === 2;
    const shelfDepth = double ? depth / 2 : depth;
    const backX = double ? x : x - faces[0] * (depth / 2);
    if (collide) addBox(new THREE.Vector3(x, TOP / 2, cz), new THREE.Vector3(depth, TOP, len), null);

    visual(new THREE.Vector3(backX, TOP / 2, cz), new THREE.Vector3(0.03, TOP, len), backMat);
    visual(new THREE.Vector3(backX, TOP + 0.13, cz), new THREE.Vector3(0.05, 0.26, len), headerMat);
    // One solid base under the whole gondola.
    const baseX = double ? x : backX + faces[0] * (shelfDepth / 2);
    visual(new THREE.Vector3(baseX, LEVELS[0] / 2, cz), new THREE.Vector3((double ? depth : shelfDepth) - 0.02, LEVELS[0], len), kickMat);
    for (const f of faces) {
      const sx = backX + f * (shelfDepth / 2);
      for (const level of LEVELS) {
        visual(new THREE.Vector3(sx, level - BOARD / 2, cz), new THREE.Vector3(shelfDepth, BOARD, len), shelfMat);
        visual(new THREE.Vector3(backX + f * shelfDepth, level - BOARD - 0.015, cz), new THREE.Vector3(0.01, 0.03, len), stripMat);
        stockRun(z0, z1, 'z', backX + f * shelfDepth, level, shelfDepth, (level === LEVELS[LEVELS.length - 1] ? TOP - level : 0.35) - 0.04, f);
      }
    }
    // Uprights every ~1.25 m.
    const n = Math.max(1, Math.round(len / 1.25));
    for (let i = 0; i <= n; i++) {
      const z = z0 + (len * i) / n;
      visual(new THREE.Vector3(x, TOP / 2, z), new THREE.Vector3(depth + 0.02, TOP, 0.03), metalMat);
    }
  };

  // --- The aisle you stand in -----------------------------------------------------------
  for (const side of [-1, 1]) {
    // Shelves face the centre of the aisle.
    gondolaZ(side * AISLE.gondolaX, AISLE.startZ, AISLE.endZ, AISLE.gondolaDepth, [-side], true);
  }

  // --- More aisles behind the display ------------------------------------------------------
  for (const x of [-6.1, -3.05, 0, 3.05, 6.1]) {
    const faces = Math.abs(x) > 6 ? [x > 0 ? -1 : 1] : [-1, 1];
    gondolaZ(x, -8.2, -3.0, Math.abs(x) > 6 ? 0.6 : 1.0, faces, true);
  }

  // --- Wall of coolers at the back ------------------------------------------------------------
  const coolerZ = ROOM.backZ + 0.45;
  const coolerW = ROOM.halfWidth * 2 - 1.0;
  const coolerH = 2.15;
  const coolerInterior = new THREE.MeshStandardMaterial({ color: 0xf6fbff, emissive: 0xdff1ff, emissiveIntensity: 0.35, roughness: 0.8 });
  visual(new THREE.Vector3(0, coolerH / 2, ROOM.backZ + 0.05), new THREE.Vector3(coolerW, coolerH, 0.1), coolerInterior);
  visual(new THREE.Vector3(0, coolerH + 0.2, coolerZ), new THREE.Vector3(coolerW + 0.1, 0.4, 0.9), kickMat);
  visual(new THREE.Vector3(0, 0.1, coolerZ), new THREE.Vector3(coolerW + 0.1, 0.2, 0.9), kickMat);
  for (const level of [0.2, 0.6, 1.0, 1.4, 1.8]) {
    visual(new THREE.Vector3(0, level - 0.01, coolerZ - 0.05), new THREE.Vector3(coolerW, 0.02, 0.7), shelfMat);
    stockRun(-coolerW / 2, coolerW / 2, 'x', coolerZ + 0.3, level, 0.7, 0.32, 1);
  }
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2 });
  const doorW = 0.75;
  const doors = Math.floor(coolerW / doorW);
  for (let i = 0; i <= doors; i++) {
    const x = -coolerW / 2 + i * (coolerW / doors);
    visual(new THREE.Vector3(x, coolerH / 2 + 0.1, coolerZ + 0.42), new THREE.Vector3(0.05, coolerH - 0.2, 0.05), metalMat);
  }
  visual(new THREE.Vector3(0, coolerH / 2 + 0.1, coolerZ + 0.43), new THREE.Vector3(coolerW, coolerH - 0.2, 0.01), glassMat);
  addSign(decor, 'FRESH FONTS DAILY', new THREE.Vector3(0, 2.95, ROOM.backZ + 0.02), 5.2, 0.6, '#1f6f50', '#ffffff');

  // --- Ceiling with light panels -------------------------------------------------------------------
  const roomD = ROOM.frontZ - ROOM.backZ;
  visual(
    new THREE.Vector3(0, ROOM.height + 0.05, (ROOM.frontZ + ROOM.backZ) / 2),
    new THREE.Vector3(ROOM.halfWidth * 2, 0.1, roomD),
    new THREE.MeshStandardMaterial({ color: 0xf1f1ef, roughness: 0.95 }),
  );
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.6 });
  for (const x of [-4.55, -1.5, 1.5, 4.55]) {
    for (let z = ROOM.frontZ - 1; z > ROOM.backZ + 1; z -= 2.6) {
      visual(new THREE.Vector3(x, ROOM.height - 0.03, z), new THREE.Vector3(0.34, 0.05, 1.5), housingMat);
      visual(new THREE.Vector3(x, ROOM.height - 0.06, z), new THREE.Vector3(0.26, 0.02, 1.42), lightMat);
    }
  }

  // --- Hanging aisle signs -------------------------------------------------------------------------
  const signs: [number, string][] = [
    [-4.55, '1  SERIFS'],
    [-1.5, '2  SANS SERIF'],
    [1.5, '3  SCRIPT & DISPLAY'],
    [4.55, '4  PUNCTUATION'],
  ];
  for (const [x, text] of signs) {
    const y = 2.85;
    const z = -3.2;
    addSign(decor, text, new THREE.Vector3(x, y, z), 1.7, 0.36, '#ffffff', '#1f6f50', true);
    for (const dx of [-0.7, 0.7]) {
      visual(new THREE.Vector3(x + dx, (y + 0.18 + ROOM.height) / 2, z), new THREE.Vector3(0.006, ROOM.height - y - 0.18, 0.006), metalMat);
    }
  }

  buildInstances(decor, boxes, cans);
}

function addSign(parent: THREE.Object3D, text: string, pos: THREE.Vector3, w: number, h: number, bg: string, fg: string, doubleSided = false): void {
  const tex = makeLabelTexture(text, bg, fg, 1024, Math.round((1024 * h) / w), `bold ${Math.round((1024 * h) / w * 0.55)}px "Helvetica Neue", Arial, sans-serif`);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.15 });
  if (doubleSided) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [mat, mat, mat, mat, mat, mat]);
    board.position.copy(pos);
    parent.add(board);
  } else {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    plane.position.copy(pos);
    parent.add(plane);
  }
}

function buildInstances(parent: THREE.Object3D, boxes: Item[], cans: Item[]): void {
  const packaging = makePackagingTexture();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();

  const make = (geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[]) => {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rotY);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx, it.sy, it.sz));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.setHex(it.color));
    });
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    parent.add(mesh);
  };

  make(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: packaging, roughness: 0.55 }), boxes);
  make(
    new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
    new THREE.MeshStandardMaterial({ map: packaging, roughness: 0.3, metalness: 0.35 }),
    cans,
  );
}
