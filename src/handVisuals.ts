// 3D hand rendering: spheres for joints, cylinders for bones, a glowing
// pinch cursor, and a small marker on the surface below the hand for depth.

import * as THREE from 'three';
import { HandLandmarker } from '@mediapipe/tasks-vision';
import type { TrackedHand } from './handMapping';

const BONES = HandLandmarker.HAND_CONNECTIONS.map(({ start, end }) => [start, end] as const);
const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

export class HandVisual {
  readonly group = new THREE.Group();
  private readonly joints: THREE.Mesh[] = [];
  private readonly bones: THREE.Mesh[] = [];
  private readonly cursor: THREE.Mesh;
  private readonly cursorMat: THREE.MeshBasicMaterial;
  private readonly marker: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly hand: TrackedHand,
    scene: THREE.Scene,
    private readonly surfaces: THREE.Object3D[],
  ) {
    const jointMat = new THREE.MeshStandardMaterial({
      color: hand.color,
      emissive: hand.color,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xf4f6fa,
      emissive: hand.color,
      emissiveIntensity: 0.15,
      roughness: 0.5,
      transparent: true,
      opacity: 0.85,
    });
    const jointGeo = new THREE.SphereGeometry(1, 12, 8);
    const boneGeo = new THREE.CylinderGeometry(1, 1, 1, 8);

    for (let i = 0; i < 21; i++) {
      const m = new THREE.Mesh(jointGeo, jointMat);
      m.scale.setScalar(i === 0 ? 0.014 : FINGERTIPS.has(i) ? 0.011 : 0.009);
      m.castShadow = true;
      this.joints.push(m);
      this.group.add(m);
    }
    for (let i = 0; i < BONES.length; i++) {
      const m = new THREE.Mesh(boneGeo, boneMat);
      m.castShadow = true;
      this.bones.push(m);
      this.group.add(m);
    }

    this.cursorMat = new THREE.MeshBasicMaterial({ color: hand.color, transparent: true, opacity: 0.55, depthWrite: false });
    this.cursor = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.cursorMat);
    this.group.add(this.cursor);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.025, 0.04, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: hand.color, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    scene.add(this.marker);

    this.group.visible = false;
    this.marker.visible = false;
    scene.add(this.group);
  }

  update(): void {
    const { hand } = this;
    this.group.visible = hand.active;
    if (!hand.active) {
      this.marker.visible = false;
      return;
    }

    for (let i = 0; i < 21; i++) this.joints[i].position.copy(hand.joints[i]);

    for (let i = 0; i < BONES.length; i++) {
      const [a, b] = BONES[i];
      const pa = hand.joints[a];
      const pb = hand.joints[b];
      const bone = this.bones[i];
      _dir.subVectors(pb, pa);
      const len = _dir.length();
      bone.position.copy(pa).addScaledVector(_dir, 0.5);
      bone.quaternion.setFromUnitVectors(_up, _dir.divideScalar(Math.max(len, 1e-6)));
      bone.scale.set(0.006, len, 0.006);
    }

    // Pinch cursor: shrinks and brightens while pinching.
    const pinching = hand.pinching;
    this.cursor.position.copy(hand.point);
    this.cursor.scale.setScalar(pinching ? 0.018 : 0.03);
    this.cursorMat.opacity = pinching ? 0.95 : 0.4;

    // Depth cue: project the grab point straight down onto whatever is below it.
    this.raycaster.set(hand.point, _down);
    this.raycaster.far = 4;
    const hit = this.raycaster.intersectObjects(this.surfaces, false)[0];
    this.marker.visible = !!hit;
    if (hit) this.marker.position.copy(hit.point).add(new THREE.Vector3(0, 0.003, 0));
  }
}
