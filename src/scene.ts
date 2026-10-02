// Three.js store: renderer, camera, lights and the static aisle geometry.
// Every static piece is also described as a box so physics can mirror it.

import * as THREE from 'three';
import { BASKET, CAMERA, COUNTER, STORE } from './config';

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

export function createStoreScene(canvas: HTMLCanvasElement): StoreScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ee);
  scene.fog = new THREE.Fog(0xdfe6ee, 7, 14);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.05, 50);
  camera.position.set(...CAMERA.position);
  camera.lookAt(new THREE.Vector3(...CAMERA.lookAt));
  camera.updateMatrixWorld();

  addLights(scene);

  const staticBoxes: StaticBox[] = [];
  const addBox = (center: THREE.Vector3, size: THREE.Vector3, material: THREE.Material | null, opts: { cast?: boolean; receive?: boolean } = {}) => {
    staticBoxes.push({ center: center.clone(), size: size.clone() });
    if (!material) return; // invisible collider
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(center);
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = opts.receive ?? true;
    scene.add(mesh);
  };

  // --- Room -----------------------------------------------------------------
  const floorMat = new THREE.MeshStandardMaterial({ map: makeTileTexture(), roughness: 0.55 });
  addBox(new THREE.Vector3(0, -0.05, 0.7), new THREE.Vector3(STORE.sideWallX * 2, 0.1, STORE.frontWallZ - STORE.backWallZ + 1), floorMat, { cast: false });

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.9 });
  const wallH = 3.2;
  addBox(new THREE.Vector3(0, wallH / 2, STORE.backWallZ - 0.05), new THREE.Vector3(STORE.sideWallX * 2, wallH, 0.1), wallMat, { cast: false });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.9 });
  const sideDepth = STORE.frontWallZ - STORE.backWallZ;
  const sideZ = (STORE.frontWallZ + STORE.backWallZ) / 2;
  addBox(new THREE.Vector3(-STORE.sideWallX - 0.05, wallH / 2, sideZ), new THREE.Vector3(0.1, wallH, sideDepth), sideMat, { cast: false });
  addBox(new THREE.Vector3(STORE.sideWallX + 0.05, wallH / 2, sideZ), new THREE.Vector3(0.1, wallH, sideDepth), sideMat, { cast: false });
  // Invisible wall behind the camera so tossed items stay in the store.
  addBox(new THREE.Vector3(0, wallH / 2, STORE.frontWallZ + 0.05), new THREE.Vector3(STORE.sideWallX * 2, wallH, 0.1), null);

  // Store sign on the back wall.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshBasicMaterial({ map: makeSignTexture('TYPE SHOP') }));
  sign.position.set(0, 2.45, STORE.backWallZ + 0.01);
  scene.add(sign);

  // --- Shelving units --------------------------------------------------------
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x41505f, roughness: 0.5, metalness: 0.3 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xd9d4cb, roughness: 0.7 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.8 });
  const { shelfWidth: W, shelfDepth: D, boardThickness: bt, panelThickness: pt, shelfTop } = STORE;
  for (const x of STORE.shelfUnitXs) {
    const z = STORE.shelfUnitZ;
    // Side panels.
    for (const side of [-1, 1]) {
      addBox(new THREE.Vector3(x + side * (W / 2 + pt / 2), shelfTop / 2, z), new THREE.Vector3(pt, shelfTop, D), frameMat);
    }
    // Back panel.
    addBox(new THREE.Vector3(x, shelfTop / 2, z - D / 2 - 0.01), new THREE.Vector3(W, shelfTop, 0.02), backMat, { cast: false });
    // Boards (the products' resting surfaces) + a top cap.
    for (const level of [...STORE.shelfLevels, shelfTop]) {
      addBox(new THREE.Vector3(x, level - bt / 2, z), new THREE.Vector3(W, bt, D), boardMat);
    }
  }

  // --- Counter + basket ---------------------------------------------------------
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.6 });
  const [cx, , cz] = COUNTER.center;
  const [cw, ch, cd] = COUNTER.size;
  addBox(new THREE.Vector3(cx, ch / 2, cz), new THREE.Vector3(cw, ch, cd), counterMat);

  const basketMat = new THREE.MeshStandardMaterial({ color: 0xd8333a, roughness: 0.45 });
  const [bw, bh, bd] = BASKET.inner;
  const t = BASKET.wall;
  const by = ch; // basket floor sits on the counter top
  addBox(new THREE.Vector3(cx, by + t / 2, cz), new THREE.Vector3(bw + 2 * t, t, bd + 2 * t), basketMat);
  addBox(new THREE.Vector3(cx - bw / 2 - t / 2, by + bh / 2, cz), new THREE.Vector3(t, bh, bd + 2 * t), basketMat);
  addBox(new THREE.Vector3(cx + bw / 2 + t / 2, by + bh / 2, cz), new THREE.Vector3(t, bh, bd + 2 * t), basketMat);
  addBox(new THREE.Vector3(cx, by + bh / 2, cz - bd / 2 - t / 2), new THREE.Vector3(bw, bh, t), basketMat);
  addBox(new THREE.Vector3(cx, by + bh / 2, cz + bd / 2 + t / 2), new THREE.Vector3(bw, bh, t), basketMat);
  // Handle (visual only).
  const handle = new THREE.Mesh(new THREE.TorusGeometry(bw / 3.2, 0.012, 8, 32, Math.PI), basketMat);
  handle.position.set(cx, by + bh, cz);
  handle.castShadow = true;
  scene.add(handle);

  const basket: BasketZone = {
    bounds: new THREE.Box3(
      new THREE.Vector3(cx - bw / 2, by + t, cz - bd / 2),
      new THREE.Vector3(cx + bw / 2, by + bh + 0.08, cz + bd / 2),
    ),
  };

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
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a58f, 1.1));

  const key = new THREE.DirectionalLight(0xfff4e5, 2.0);
  key.position.set(2.0, 4.5, 3.0);
  key.target.position.set(0, 0.8, -0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xdfeaff, 0.6);
  fill.position.set(-3, 3, 2);
  scene.add(fill);
}

function makeTileTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d7d2c8';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#cbc5b9';
  g.fillRect(0, 0, 128, 128);
  g.fillRect(128, 128, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  g.strokeRect(0, 0, 128, 128);
  g.strokeRect(128, 128, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeSignTexture(text: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f6d4f';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#ffffff';
  g.font = 'bold 110px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
