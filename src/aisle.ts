// The supermarket aisle: shelving ("gondolas") down both sides, fully
// stocked with branded groceries, price tags and SAVE talkers, overstock
// cartons on top, more shelving at the far end, and four "type bays" near
// you where the letters live. Returns where the letter shelves are.

import * as THREE from 'three';
import {
  BRANDS,
  bottleGeometry,
  bottleTexture,
  brandFrontTexture,
  brandSideTexture,
  cartonTexture,
  priceTagTexture,
  saveSignTexture,
  type Brand,
} from './brands';
import { AISLE, ROOM } from './config';
import type { AddBox } from './scene';
import { makeLabelTexture, makePegboardTexture, seededRandom } from './textures';
import { TYPE_BAYS, type Typeface } from './typefaces';

/** A shelf row that holds letters of one typeface. */
export interface TypeShelf {
  typeface: Typeface;
  side: -1 | 1;
  /** Near (larger z) and far end of the row. */
  z0: number;
  z1: number;
  /** Top surface of the board. */
  y: number;
}

interface Placement {
  pos: THREE.Vector3;
  rotY: number;
  scale: THREE.Vector3;
}

const PRICES = ['$5.99', '$10.99', '$3.49', '$2.25'];
const RAIL_H = 0.045;

export function buildAisle(scene: THREE.Scene, addBox: AddBox): TypeShelf[] {
  const decor = new THREE.Group();
  decor.name = 'decor';
  scene.add(decor);
  const rand = seededRandom(11);

  const visual = (center: THREE.Vector3, size: THREE.Vector3, mat: THREE.Material, cast = false) =>
    addBox(center, size, mat, { collide: false, cast, receive: true, parent: decor });

  const boardMat = new THREE.MeshStandardMaterial({ color: 0xd3d7db, roughness: 0.4, metalness: 0.45 });
  const uprightMat = new THREE.MeshStandardMaterial({ color: 0x8f979f, roughness: 0.45, metalness: 0.5 });
  const kickMat = new THREE.MeshStandardMaterial({ color: 0x24533f, roughness: 0.5, metalness: 0.2 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.5 });
  const peg = makePegboardTexture();
  peg.repeat.set(3, 4);
  const backMat = new THREE.MeshStandardMaterial({ map: peg, color: 0xc9ced3, roughness: 0.6 });

  // Instance buckets.
  const brandItems = new Map<Brand, Placement[]>();
  const tags: Placement[][] = PRICES.map(() => []);
  const talkers: Placement[] = [];
  const cartons: Placement[] = [];

  const typeShelves: TypeShelf[] = [];
  const { frontX, depth, levels, height, board } = AISLE;

  // Bay boundaries along z (near → far): a short bay by the camera, the two type bays, then groceries.
  const bounds = [AISLE.startZ, AISLE.typeBays[0][0], AISLE.typeBays[0][1], AISLE.typeBays[1][1]];
  const rest = AISLE.typeBays[1][1] - AISLE.endZ;
  const n = Math.round(rest / 1.5);
  for (let i = 1; i <= n; i++) bounds.push(AISLE.typeBays[1][1] - (rest * i) / n);

  for (const side of [-1, 1] as const) {
    const sx = (offset: number) => side * (frontX + offset); // offset > 0 = into the shelf
    const faceRot = side < 0 ? Math.PI / 2 : -Math.PI / 2; // turns a +z front towards the aisle
    const len = AISLE.startZ - AISLE.endZ;
    const cz = (AISLE.startZ + AISLE.endZ) / 2;

    // Back panel, base and the end panel nearest to you.
    visual(new THREE.Vector3(sx(depth + 0.01), height / 2, cz), new THREE.Vector3(0.02, height, len), backMat);
    visual(new THREE.Vector3(sx(depth / 2), levels[0] / 2 - 0.005, cz), new THREE.Vector3(depth - 0.02, levels[0] - 0.01, len), kickMat);
    visual(new THREE.Vector3(sx(depth / 2), height / 2, AISLE.startZ), new THREE.Vector3(depth + 0.04, height, 0.04), uprightMat, true);
    addBox(new THREE.Vector3(sx(depth + 0.01), height / 2, cz), new THREE.Vector3(0.04, height, len), null);

    for (let b = 0; b < bounds.length - 1; b++) {
      const z0 = bounds[b];
      const z1 = bounds[b + 1];
      const bayLen = z0 - z1;
      const bz = (z0 + z1) / 2;
      const typeBay = TYPE_BAYS.find((t) => t.side === side && AISLE.typeBays[t.bay][0] === z0);

      // Upright at the far end of the bay.
      visual(new THREE.Vector3(sx(depth / 2), height / 2, z1), new THREE.Vector3(depth + 0.02, height, 0.03), uprightMat);

      if (!typeBay) {
        // Grocery bay: one solid collider for the stocked face.
        addBox(new THREE.Vector3(sx(depth / 2), height / 2, bz), new THREE.Vector3(depth, height, bayLen), null);
      } else {
        addSign(decor, typeBay.header, new THREE.Vector3(sx(-0.05), 2.34, z0 - 0.03), 1.0, 0.26);
        // Rod holding the sign.
        visual(new THREE.Vector3(sx(-0.05), (2.47 + ROOM.height) / 2, z0 - 0.03), new THREE.Vector3(0.012, ROOM.height - 2.47, 0.012), uprightMat);
      }

      levels.forEach((level, li) => {
        const row = typeBay ? (AISLE.typeLevels as readonly number[]).indexOf(li) : -1;
        const boardSize = new THREE.Vector3(depth, board, bayLen);
        const boardPos = new THREE.Vector3(sx(depth / 2), level - board / 2, bz);
        if (typeBay) addBox(boardPos, boardSize, boardMat);
        else visual(boardPos, boardSize, boardMat);

        if (row >= 0) {
          // Letters go here (products.ts adds the typeface label on the rail).
          typeShelves.push({ typeface: typeBay!.rows[row], side, z0, z1, y: level });
          return;
        }
        visual(new THREE.Vector3(sx(-0.004), level - RAIL_H / 2 - 0.003, bz), new THREE.Vector3(0.008, RAIL_H, bayLen), railMat);
        const maxH = (li === levels.length - 1 ? height : levels[li + 1] - board) - level - 0.03;
        stockShelf(z0, z1, level, maxH);
      });

      // Overstock cartons on top of the gondola (kept clear above the type bays so their signs read).
      let z = z0 - 0.05;
      while (!typeBay && z > z1 + 0.35) {
        const w = 0.3 + rand() * 0.25;
        const h = 0.2 + rand() * 0.3;
        if (rand() < 0.8) cartons.push({ pos: new THREE.Vector3(sx(depth / 2), height + h / 2, z - w / 2), rotY: 0, scale: new THREE.Vector3(depth * 0.85, h, w) });
        z -= w + 0.04;
      }
    }

    /** Fill one shelf with groups of identical products ("facings"), front-aligned. */
    function stockShelf(z0: number, z1: number, level: number, maxH: number): void {
      let z = z0 - 0.02;
      while (z > z1 + 0.1) {
        const candidates = BRANDS.filter((b) => b.size[1] <= maxH);
        const brand = candidates[Math.floor(rand() * candidates.length)];
        const [w, h, d] = brand.size;
        const facings = 2 + Math.floor(rand() * 5);
        const rows = Math.max(1, Math.floor((depth - 0.04) / (d + 0.01)));
        const groupStart = z;
        let placed = 0;
        for (let i = 0; i < facings && z - w > z1 + 0.01; i++) {
          const zc = z - w / 2;
          for (let r = 0; r < rows; r++) {
            const list = brandItems.get(brand) ?? [];
            const x = sx(0.02 + d / 2 + r * (d + 0.01));
            list.push({
              pos: new THREE.Vector3(x, level + h / 2, zc),
              rotY: brand.shape === 'box' ? faceRot : 0,
              scale: new THREE.Vector3(w, h, brand.shape === 'box' ? d : w),
            });
            brandItems.set(brand, list);
          }
          z -= w + 0.008;
          placed++;
        }
        if (placed === 0) break;
        // Price tag on the rail at the start of the group, sometimes a SAVE talker.
        tags[Math.floor(rand() * PRICES.length)].push({
          pos: new THREE.Vector3(sx(-0.0095), level - RAIL_H / 2 - 0.003, groupStart - 0.05),
          rotY: faceRot,
          scale: new THREE.Vector3(1, 1, 1),
        });
        if (rand() < 0.1 && level > 0.3) {
          talkers.push({ pos: new THREE.Vector3(sx(-0.06), level + 0.09, groupStart - 0.01), rotY: 0, scale: new THREE.Vector3(1, 1, 1) });
        }
        z -= 0.03;
      }
    }
  }

  buildFarEnd(decor, visual, addBox, boardMat, kickMat, brandItems, rand);
  buildNeighbourAisles(visual, cartons, rand);

  // --- Instanced meshes -------------------------------------------------------------------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const bottleGeo = bottleGeometry();
  for (const [brand, list] of brandItems) {
    if (brand.shape === 'box') {
      const side = new THREE.MeshStandardMaterial({ map: brandSideTexture(brand), roughness: 0.55 });
      const front = new THREE.MeshStandardMaterial({ map: brandFrontTexture(brand), roughness: 0.5 });
      instanced(decor, boxGeo, [side, side, side, side, front, side], list);
    } else {
      instanced(decor, bottleGeo, new THREE.MeshStandardMaterial({ map: bottleTexture(brand), roughness: 0.2, metalness: 0.05 }), list);
    }
  }
  PRICES.forEach((p, i) => instanced(decor, new THREE.PlaneGeometry(0.075, 0.047), new THREE.MeshStandardMaterial({ map: priceTagTexture(p), roughness: 0.7 }), tags[i]));
  instanced(decor, new THREE.PlaneGeometry(0.13, 0.17), new THREE.MeshStandardMaterial({ map: saveSignTexture(), roughness: 0.6, side: THREE.DoubleSide }), talkers);
  instanced(decor, boxGeo, new THREE.MeshStandardMaterial({ map: cartonTexture(), roughness: 0.85 }), cartons);

  return typeShelves;
}

/** Shelving across the far end of the aisle plus a big store sign. */
function buildFarEnd(
  decor: THREE.Group,
  visual: (c: THREE.Vector3, s: THREE.Vector3, m: THREE.Material, cast?: boolean) => unknown,
  addBox: AddBox,
  boardMat: THREE.Material,
  kickMat: THREE.Material,
  brandItems: Map<Brand, Placement[]>,
  rand: () => number,
): void {
  const z = ROOM.backZ + 0.35;
  const w = ROOM.halfWidth * 2 - 0.4;
  const d = 0.5;
  visual(new THREE.Vector3(0, AISLE.height / 2, z - d / 2), new THREE.Vector3(w, AISLE.height, 0.03), new THREE.MeshStandardMaterial({ color: 0xc9ced3 }));
  visual(new THREE.Vector3(0, AISLE.levels[0] / 2, z), new THREE.Vector3(w, AISLE.levels[0], d), kickMat);
  addBox(new THREE.Vector3(0, AISLE.height / 2, z), new THREE.Vector3(w, AISLE.height, d), null);
  for (const level of AISLE.levels) {
    visual(new THREE.Vector3(0, level - 0.0125, z), new THREE.Vector3(w, 0.025, d), boardMat);
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.3) {
      const brand = BRANDS[Math.floor(rand() * BRANDS.length)];
      const [bw, bh, bd] = brand.size;
      const facings = 2 + Math.floor(rand() * 5);
      for (let i = 0; i < facings && x + bw < w / 2; i++) {
        const list = brandItems.get(brand) ?? [];
        list.push({
          pos: new THREE.Vector3(x + bw / 2, level + bh / 2, z + d / 2 - 0.02 - bd / 2),
          rotY: 0,
          scale: new THREE.Vector3(bw, bh, brand.shape === 'box' ? bd : bw),
        });
        brandItems.set(brand, list);
        x += bw + 0.008;
      }
      x += 0.03;
    }
  }
  addSign(decor, 'TYPE SHOP  ·  FRESH FONTS DAILY', new THREE.Vector3(0, 2.75, ROOM.backZ + 0.02), 4.6, 0.5, false);
}

/** Tops of the neighbouring aisles' shelving, visible above ours. */
function buildNeighbourAisles(
  visual: (c: THREE.Vector3, s: THREE.Vector3, m: THREE.Material, cast?: boolean) => unknown,
  cartons: Placement[],
  rand: () => number,
): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0xb4bcc4, roughness: 0.6, metalness: 0.3 });
  for (const side of [-1, 1]) {
    const x = side * 3.0;
    const len = AISLE.startZ - AISLE.endZ;
    const cz = (AISLE.startZ + AISLE.endZ) / 2;
    visual(new THREE.Vector3(x, AISLE.height / 2, cz), new THREE.Vector3(1.1, AISLE.height, len), mat);
    let z = AISLE.startZ;
    while (z > AISLE.endZ + 0.5) {
      const w = 0.35 + rand() * 0.3;
      const h = 0.2 + rand() * 0.35;
      if (rand() < 0.7) cartons.push({ pos: new THREE.Vector3(x, AISLE.height + h / 2, z - w / 2), rotY: 0, scale: new THREE.Vector3(0.8, h, w) });
      z -= w + 0.08;
    }
  }
}

function addSign(parent: THREE.Object3D, text: string, pos: THREE.Vector3, w: number, h: number, doubleSided = true): void {
  const px = Math.round((1024 * h) / w);
  const tex = makeLabelTexture(text, '#1f6f50', '#ffffff', 1024, px, `bold ${Math.round(px * 0.55)}px "Helvetica Neue", Arial, sans-serif`);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  sign.position.copy(pos);
  parent.add(sign);
}

function instanced(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], list: Placement[]): void {
  if (list.length === 0) return;
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  list.forEach((p, i) => {
    q.setFromAxisAngle(up, p.rotY);
    mesh.setMatrixAt(i, m.compose(p.pos, q, p.scale));
  });
  mesh.receiveShadow = true;
  parent.add(mesh);
}
