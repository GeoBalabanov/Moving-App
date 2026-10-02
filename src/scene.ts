// Three.js store: renderer, camera, lights and the interactive display
// (the three type shelving units + basket counter). The rest of the store
// dressing lives in decor.ts. Every static piece that letters can hit is also
// described as a box so physics can mirror it.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BASKET, CAMERA, COUNTER, ROOM, STORE } from './config';
import { buildStoreDecor } from './decor';
import { makeLabelTexture, makePegboardTexture, makeTileTexture } from './textures';

export interface StaticBox {
  center: THREE.Vector3;
  size: THREE.Vector3;
}

export interface BasketZone {
  /** Interior volume; a product whose centre is inside counts as "in the basket". */
  bounds: THREE.Box3;
}

export interface StoreScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  staticBoxes: StaticBox[];
  basket: BasketZone;
  resize(): void;
}

export type AddBox = (
  center: THREE.Vector3,
  size: THREE.Vector3,
  material: THREE.Material | THREE.Material[] | null,
  opts?: { cast?: boolean; receive?: boolean; collide?: boolean; parent?: THREE.Object3D },
) => THREE.Mesh | null;

/** Header text above each display unit, matching the typeface groups in typefaces.ts. */
const UNIT_HEADERS = ['SERIFS', 'SLABS & GROTESQUES', 'SANS & SCRIPTS'];

export function createStoreScene(canvas: HTMLCanvasElement): StoreScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9dde1);
  scene.fog = new THREE.Fog(0xd9dde1, 12, 26);

  // Soft image-based lighting gives the glossy floor and painted metal believable reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.05, 60);
  camera.position.set(...CAMERA.position);
  camera.lookAt(new THREE.Vector3(...CAMERA.lookAt));
  camera.updateMatrixWorld();

  addLights(scene);

  const staticBoxes: StaticBox[] = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const addBox: AddBox = (center, size, material, opts = {}) => {
    if (opts.collide ?? true) staticBoxes.push({ center: center.clone(), size: size.clone() });
    if (!material) return null; // invisible collider
    const mesh = new THREE.Mesh(boxGeo, material);
    mesh.position.copy(center);
    mesh.scale.copy(size);
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = opts.receive ?? true;
    (opts.parent ?? scene).add(mesh);
    return mesh;
  };

  // --- Room shell -------------------------------------------------------------
  const roomW = ROOM.halfWidth * 2;
  const roomD = ROOM.frontZ - ROOM.backZ;
  const roomCz = (ROOM.frontZ + ROOM.backZ) / 2;
  const tile = makeTileTexture();
  tile.repeat.set(roomW / 0.6, roomD / 0.6);
  const floorMat = new THREE.MeshStandardMaterial({ map: tile, roughness: 0.28, metalness: 0.0 });
  addBox(new THREE.Vector3(0, -0.05, roomCz), new THREE.Vector3(roomW, 0.1, roomD), floorMat, { cast: false });

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.9 });
  addBox(new THREE.Vector3(0, ROOM.height / 2, ROOM.backZ - 0.05), new THREE.Vector3(roomW, ROOM.height, 0.1), wallMat, { cast: false });
  for (const side of [-1, 1]) {
    addBox(new THREE.Vector3(side * (ROOM.halfWidth + 0.05), ROOM.height / 2, roomCz), new THREE.Vector3(0.1, ROOM.height, roomD), wallMat, { cast: false });
  }
  // Invisible wall behind the camera so tossed letters stay in the store.
  addBox(new THREE.Vector3(0, ROOM.height / 2, STORE.frontWallZ + 0.05), new THREE.Vector3(roomW, ROOM.height, 0.1), null);

  // --- The type display: three gondola shelving units ------------------------------
  const uprightMat = new THREE.MeshStandardMaterial({ color: 0xe4e7ea, roughness: 0.35, metalness: 0.4 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.4, metalness: 0.15 });
  const pegboard = makePegboardTexture();
  pegboard.repeat.set(STORE.shelfWidth / 0.5, STORE.shelfTop / 0.5);
  const backMat = new THREE.MeshStandardMaterial({ map: pegboard, roughness: 0.6, metalness: 0.1 });
  const kickMat = new THREE.MeshStandardMaterial({ color: 0x2f3a45, roughness: 0.5, metalness: 0.3 });
  const { shelfWidth: W, shelfDepth: D, boardThickness: bt, panelThickness: pt, shelfTop } = STORE;
  const kickH = STORE.shelfLevels[0] - bt;

  STORE.shelfUnitXs.forEach((x, unit) => {
    const z = STORE.shelfUnitZ;
    for (const side of [-1, 1]) {
      addBox(new THREE.Vector3(x + side * (W / 2 + pt / 2), shelfTop / 2, z), new THREE.Vector3(pt, shelfTop, D), uprightMat);
    }
    addBox(new THREE.Vector3(x, shelfTop / 2, z - D / 2 - 0.01), new THREE.Vector3(W, shelfTop, 0.02), backMat, { cast: false });
    // Base kick plate under the bottom shelf.
    addBox(new THREE.Vector3(x, kickH / 2, z + 0.02), new THREE.Vector3(W, kickH, D - 0.04), kickMat);
    for (const level of [...STORE.shelfLevels, shelfTop]) {
      addBox(new THREE.Vector3(x, level - bt / 2, z), new THREE.Vector3(W, bt, D), boardMat);
    }
    // Header sign on top of the unit.
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(W + 2 * pt, 0.26, 0.04),
      [uprightMat, uprightMat, uprightMat, uprightMat, new THREE.MeshStandardMaterial({ map: makeLabelTexture(UNIT_HEADERS[unit], '#1f6f50', '#ffffff', 1024, 160, 'bold 84px "Helvetica Neue", Arial, sans-serif'), roughness: 0.5 }), uprightMat],
    );
    header.position.set(x, shelfTop + 0.15, z - D / 2 + 0.02);
    header.castShadow = true;
    scene.add(header);
  });

  // --- Basket counter --------------------------------------------------------------
  const [cx, , cz] = COUNTER.center;
  const [cw, ch, cd] = COUNTER.size;
  const counterBaseMat = new THREE.MeshStandardMaterial({ color: 0x2f3a45, roughness: 0.45, metalness: 0.35 });
  const counterTopMat = new THREE.MeshStandardMaterial({ color: 0x9c7a58, roughness: 0.45 });
  addBox(new THREE.Vector3(cx, (ch - 0.04) / 2, cz), new THREE.Vector3(cw - 0.04, ch - 0.04, cd - 0.04), counterBaseMat);
  addBox(new THREE.Vector3(cx, ch - 0.02, cz), new THREE.Vector3(cw, 0.04, cd), counterTopMat);
  // Front sign on the counter.
  const counterSign = new THREE.Mesh(
    new THREE.PlaneGeometry(cw * 0.8, 0.12),
    new THREE.MeshStandardMaterial({ map: makeLabelTexture('DROP LETTERS IN THE BASKET', '#ffd23f', '#1d1d1d', 1024, 120, 'bold 56px "Helvetica Neue", Arial, sans-serif'), roughness: 0.6 }),
  );
  counterSign.position.set(cx, ch * 0.55, cz + cd / 2 - 0.018);
  scene.add(counterSign);

  // Wire-style shopping basket.
  const basketMat = new THREE.MeshStandardMaterial({ color: 0xd8333a, roughness: 0.4, metalness: 0.1 });
  const [bw, bh, bd] = BASKET.inner;
  const t = BASKET.wall;
  const by = ch;
  addBox(new THREE.Vector3(cx, by + t / 2, cz), new THREE.Vector3(bw + 2 * t, t, bd + 2 * t), basketMat);
  addBox(new THREE.Vector3(cx - bw / 2 - t / 2, by + bh / 2, cz), new THREE.Vector3(t, bh, bd + 2 * t), basketMat);
  addBox(new THREE.Vector3(cx + bw / 2 + t / 2, by + bh / 2, cz), new THREE.Vector3(t, bh, bd + 2 * t), basketMat);
  addBox(new THREE.Vector3(cx, by + bh / 2, cz - bd / 2 - t / 2), new THREE.Vector3(bw, bh, t), basketMat);
  addBox(new THREE.Vector3(cx, by + bh / 2, cz + bd / 2 + t / 2), new THREE.Vector3(bw, bh, t), basketMat);
  // Rim + handles (visual only).
  for (const [dx, dz, sx, sz] of [[0, 1, 1, 0], [0, -1, 1, 0], [1, 0, 0, 1], [-1, 0, 0, 1]]) {
    addBox(
      new THREE.Vector3(cx + dx * (bw / 2 + t), by + bh + 0.008, cz + dz * (bd / 2 + t)),
      new THREE.Vector3(sx * (bw + 2 * t) + 0.024, 0.016, sz * (bd + 2 * t) + 0.024),
      basketMat,
      { collide: false },
    );
  }
  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(bd / 3, 0.01, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    handle.rotation.y = Math.PI / 2;
    handle.position.set(cx + side * (bw / 2 - 0.04), by + bh, cz);
    handle.castShadow = true;
    scene.add(handle);
  }

  const basket: BasketZone = {
    bounds: new THREE.Box3(
      new THREE.Vector3(cx - bw / 2, by + t, cz - bd / 2),
      new THREE.Vector3(cx + bw / 2, by + bh + 0.08, cz + bd / 2),
    ),
  };

  // --- Rest of the store: aisles, ceiling, lights, signs ------------------------------
  buildStoreDecor(scene, addBox);

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, staticBoxes, basket, resize };
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b1a5, 0.35));

  // Mostly top-down key light, like store ceiling fixtures; casts the shadows.
  const key = new THREE.DirectionalLight(0xfffaf2, 1.45);
  key.position.set(1.2, 6, 2.8);
  key.target.position.set(0, 0.6, -0.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3.6;
  key.shadow.camera.right = 3.6;
  key.shadow.camera.top = 3.2;
  key.shadow.camera.bottom = -2.4;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xe6efff, 0.3);
  fill.position.set(-3, 3, 4);
  scene.add(fill);
}
