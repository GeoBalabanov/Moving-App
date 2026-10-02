// Three.js store: renderer, camera, lighting, the room shell and the
// first-person shopping cart. The shelving lives in aisle.ts. Every static
// piece letters can hit is also described as a box so physics can mirror it.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildAisle, type TypeShelf } from './aisle';
import { CAMERA, CART, REACH, ROOM } from './config';
import { makeTileTexture, makeWireTexture } from './textures';

export interface StaticBox {
  center: THREE.Vector3;
  size: THREE.Vector3;
}

export interface BasketZone {
  /** Interior volume; a product whose centre is inside counts as "in the cart". */
  bounds: THREE.Box3;
}

export interface StoreScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  staticBoxes: StaticBox[];
  basket: BasketZone;
  typeShelves: TypeShelf[];
  resize(): void;
}

export type AddBox = (
  center: THREE.Vector3,
  size: THREE.Vector3,
  material: THREE.Material | THREE.Material[] | null,
  opts?: { cast?: boolean; receive?: boolean; collide?: boolean; parent?: THREE.Object3D },
) => THREE.Mesh | null;

export function createStoreScene(canvas: HTMLCanvasElement): StoreScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfd2d4);
  scene.fog = new THREE.Fog(0xcfd2d4, 14, 30);

  // Soft image-based lighting for reflections on the floor, metal and bottles.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
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

  // --- Room shell ------------------------------------------------------------------
  const roomW = ROOM.halfWidth * 2;
  const roomD = ROOM.frontZ - ROOM.backZ;
  const roomCz = (ROOM.frontZ + ROOM.backZ) / 2;
  const tile = makeTileTexture();
  tile.repeat.set(roomW / 0.5, roomD / 0.5);
  addBox(new THREE.Vector3(0, -0.05, roomCz), new THREE.Vector3(roomW, 0.1, roomD), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.3 }), { cast: false });

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.9 });
  addBox(new THREE.Vector3(0, ROOM.height / 2, ROOM.backZ - 0.05), new THREE.Vector3(roomW, ROOM.height, 0.1), wallMat, { cast: false });
  for (const side of [-1, 1]) {
    addBox(new THREE.Vector3(side * (ROOM.halfWidth + 0.05), ROOM.height / 2, roomCz), new THREE.Vector3(0.1, ROOM.height, roomD), wallMat, { cast: false });
  }
  // Invisible wall just behind you so tossed letters stay in the store.
  addBox(new THREE.Vector3(0, ROOM.height / 2, REACH.maxZ + 0.15), new THREE.Vector3(roomW, ROOM.height, 0.1), null);

  // Ceiling with rows of light panels.
  const ceiling = new THREE.Group();
  scene.add(ceiling);
  addBox(new THREE.Vector3(0, ROOM.height + 0.05, roomCz), new THREE.Vector3(roomW, 0.1, roomD), new THREE.MeshStandardMaterial({ color: 0xbfc4c9, roughness: 0.9 }), { collide: false, cast: false, parent: ceiling });
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x6d737a, roughness: 0.7 });
  for (const x of [0, -3.0, 3.0]) {
    for (let z = ROOM.frontZ - 1.2; z > ROOM.backZ + 0.8; z -= 2.4) {
      addBox(new THREE.Vector3(x, ROOM.height - 0.02, z), new THREE.Vector3(0.7, 0.04, 1.3), housingMat, { collide: false, cast: false, parent: ceiling });
      addBox(new THREE.Vector3(x, ROOM.height - 0.045, z), new THREE.Vector3(0.6, 0.01, 1.2), panelMat, { collide: false, cast: false, parent: ceiling });
    }
  }

  // --- Shelving --------------------------------------------------------------------------
  const typeShelves = buildAisle(scene, addBox);

  // --- First-person shopping cart -----------------------------------------------------------
  const basket = buildCart(scene, addBox);

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, staticBoxes, basket, typeShelves, resize };
}

function buildCart(scene: THREE.Scene, addBox: AddBox): BasketZone {
  const [cx, , cz] = CART.center;
  const [w, h, d] = CART.inner;
  const y0 = CART.floorY;
  const t = CART.wall;

  const wire = (repeatU: number, repeatV: number) => {
    const tex = makeWireTexture();
    tex.repeat.set(repeatU, repeatV);
    return new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.3, color: 0xdfe3e7 });
  };
  const cell = 0.035;
  // Wire panels (they collide, so letters can be dropped in).
  addBox(new THREE.Vector3(cx, y0, cz), new THREE.Vector3(w, t, d), wire(w / cell, d / cell), { cast: true });
  for (const sx of [-1, 1]) {
    addBox(new THREE.Vector3(cx + sx * (w / 2 + t / 2), y0 + h / 2, cz), new THREE.Vector3(t, h, d), wire(d / cell, h / cell));
  }
  for (const sz of [-1, 1]) {
    addBox(new THREE.Vector3(cx, y0 + h / 2, cz + sz * (d / 2 + t / 2)), new THREE.Vector3(w + 2 * t, h, t), wire(w / cell, h / cell));
  }

  // Frame tubes, handle, chassis and wheels (visual only).
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.85, roughness: 0.25 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.35 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7 });
  const v = (x: number, y: number, z: number) => new THREE.Vector3(cx + x, y, cz + z);
  const s = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const r = 0.016;
  const top = y0 + h;
  addBox(v(0, top, -d / 2), s(w + 0.04, r, r), metal, { collide: false });
  addBox(v(0, top, d / 2), s(w + 0.04, r, r), metal, { collide: false });
  for (const sx of [-1, 1]) {
    addBox(v(sx * (w / 2 + 0.01), top, 0), s(r, r, d + 0.02), metal, { collide: false });
    // Handle arms and the bars down to the chassis.
    addBox(v(sx * (w / 2 + 0.01), top + 0.03, d / 2 + 0.08), s(r, r, 0.17), metal, { collide: false });
    addBox(v(sx * (w / 2 - 0.02), y0 / 2 + 0.05, d / 2 - 0.02), s(r, y0 - 0.02, r), metal, { collide: false });
    addBox(v(sx * (w / 2 - 0.04), 0.14, 0), s(r, r, d + 0.1), metal, { collide: false });
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), black);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.copy(v(sx * (w / 2 - 0.06), 0.045, sz * (d / 2 - 0.08)));
      wheel.castShadow = true;
      scene.add(wheel);
    }
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, w + 0.08, 16), red);
  handle.rotation.z = Math.PI / 2;
  handle.position.copy(v(0, top + 0.03, d / 2 + 0.17));
  handle.castShadow = true;
  scene.add(handle);
  // Lower tray.
  addBox(v(0, 0.17, 0), s(w - 0.08, 0.008, d - 0.1), wire((w - 0.08) / cell, (d - 0.1) / cell), { collide: false });

  return {
    bounds: new THREE.Box3(new THREE.Vector3(cx - w / 2, y0, cz - d / 2), new THREE.Vector3(cx + w / 2, top + 0.05, cz + d / 2)),
  };
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbfb29c, 0.75));

  // Top-down key light (like the ceiling fixtures), casting shadows near you.
  const key = new THREE.DirectionalLight(0xfffaf0, 1.5);
  key.position.set(0.6, 7, 4.5);
  key.target.position.set(0, 0.5, -1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xeef3ff, 0.35);
  fill.position.set(0, 2, 6);
  scene.add(fill);
}
