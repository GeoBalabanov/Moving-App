// 3D hand rendering: spheres for joints, cylinders for bones, a glowing
// pinch cursor, and a small marker on the surface below the hand for depth.
// A faint "x-ray" copy is drawn on top of everything so the hand stays
// visible even when it's behind a shelf or a letter.

import * as THREE from 'three';
import { HandLandmarker } from '@mediapipe/tasks-vision';
import type { TrackedHand } from './handMapping';

const BONES = HandLandmarker.HAND_CONNECTIONS.map(({ start, end }) => [start, end] as const);
const FINGERTIPS = new Set([4, 8, 12, 16, 20]);
const JOINT_RADIUS = 0.017;
const TIP_RADIUS = 0.015;
const WRIST_RADIUS = 0.022;
const BONE_RADIUS = 0.011;

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _lift = new THREE.Vector3(0, 0.003, 0);

interface Skeleton {
  joints: THREE.Mesh[];
  bones: THREE.Mesh[];
}

export class HandVisual {
  readonly group = new THREE.Group();
  private readonly solid: Skeleton;
  private readonly ghost: Skeleton;
  private readonly cursor: THREE.Mesh;
  private readonly cursorMat: THREE.MeshBasicMaterial;
  private readonly marker: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly hand: TrackedHand,
    scene: THREE.Scene,
    private readonly surfaces: THREE.Object3D[],
  ) {
    const jointGeo = new THREE.SphereGeometry(1, 16, 12);
    const boneGeo = new THREE.CylinderGeometry(1, 1, 1, 12);

    this.solid = this.buildSkeleton(
      jointGeo,
      boneGeo,
      new THREE.MeshStandardMaterial({ color: hand.color, emissive: hand.color, emissiveIntensity: 0.45, roughness: 0.35 }),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: hand.color, emissiveIntensity: 0.25, roughness: 0.4 }),
      true,
    );
    const ghostMat = (opacity: number) =>
      new THREE.MeshBasicMaterial({ color: hand.color, transparent: true, opacity, depthTest: false, depthWrite: false });
    this.ghost = this.buildSkeleton(jointGeo, boneGeo, ghostMat(0.35), ghostMat(0.25), false);

    this.cursorMat = new THREE.MeshBasicMaterial({ color: hand.color, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false });
    this.cursor = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), this.cursorMat);
    this.cursor.renderOrder = 11;
    this.group.add(this.cursor);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.045, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: hand.color, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    scene.add(this.marker);

    this.group.visible = false;
    this.marker.visible = false;
    scene.add(this.group);
  }

  private buildSkeleton(
    jointGeo: THREE.BufferGeometry,
    boneGeo: THREE.BufferGeometry,
    jointMat: THREE.Material,
    boneMat: THREE.Material,
    shadows: boolean,
  ): Skeleton {
    const joints: THREE.Mesh[] = [];
    const bones: THREE.Mesh[] = [];
    for (let i = 0; i < 21; i++) {
      const m = new THREE.Mesh(jointGeo, jointMat);
      m.scale.setScalar(i === 0 ? WRIST_RADIUS : FINGERTIPS.has(i) ? TIP_RADIUS : JOINT_RADIUS);
      m.castShadow = shadows;
      if (!shadows) m.renderOrder = 10;
      joints.push(m);
      this.group.add(m);
    }
    for (let i = 0; i < BONES.length; i++) {
      const m = new THREE.Mesh(boneGeo, boneMat);
      m.castShadow = shadows;
      if (!shadows) m.renderOrder = 10;
      bones.push(m);
      this.group.add(m);
    }
    return { joints, bones };
  }

  update(): void {
    const { hand } = this;
    this.group.visible = hand.active;
    if (!hand.active) {
      this.marker.visible = false;
      return;
    }

    for (const sk of [this.solid, this.ghost]) {
      for (let i = 0; i < 21; i++) sk.joints[i].position.copy(hand.joints[i]);
      for (let i = 0; i < BONES.length; i++) {
        const [a, b] = BONES[i];
        const pa = hand.joints[a];
        const pb = hand.joints[b];
        const bone = sk.bones[i];
        _dir.subVectors(pb, pa);
        const len = _dir.length();
        bone.position.copy(pa).addScaledVector(_dir, 0.5);
        bone.quaternion.setFromUnitVectors(_up, _dir.divideScalar(Math.max(len, 1e-6)));
        bone.scale.set(BONE_RADIUS, len, BONE_RADIUS);
      }
    }

    // Pinch cursor: shrinks and brightens while pinching.
    const pinching = hand.pinching;
    this.cursor.position.copy(hand.point);
    this.cursor.scale.setScalar(pinching ? 0.022 : 0.035);
    this.cursorMat.opacity = pinching ? 0.95 : 0.45;

    // Depth cue: project the grab point straight down onto whatever is below it.
    this.raycaster.set(hand.point, _down);
    this.raycaster.far = 4;
    const hit = this.raycaster.intersectObjects(this.surfaces, false)[0];
    this.marker.visible = !!hit;
    if (hit) this.marker.position.copy(hit.point).add(_lift);
  }
}
