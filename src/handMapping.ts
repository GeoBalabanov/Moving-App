// Maps 2D webcam landmarks into a 3D hand in the store scene.
//
// x/y come from where the hand is in the (mirrored) webcam image, projected
// along the virtual camera's view ray. Depth comes from the apparent hand size
// (wrist → middle knuckle): a bigger hand is closer to the webcam. Joint
// offsets are rebuilt at a fixed world scale so the virtual hand doesn't grow
// or shrink with depth. Everything is smoothed with One Euro filters.

import * as THREE from 'three';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { HAND_MAPPING } from './config';
import { OneEuroFilter, OneEuroFilter3 } from './filters';
import { LM, PinchDetector, handSize } from './gestures';
import type { Grabber } from './grabber';
import type { DetectedHand, Handedness } from './handTracking';
import { HAND_COLORS } from './handTracking';

const NUM_LANDMARKS = 21;

/** Depth calibration shared by both hands: the observed range of hand sizes. */
export const depthCalibration = {
  min: HAND_MAPPING.sizeFar,
  max: HAND_MAPPING.sizeNear,
  lastT: 0,
  observe(size: number, t: number): void {
    const dt = this.lastT ? Math.min(t - this.lastT, 0.5) : 0;
    this.lastT = t;
    // Relax ~3%/s back toward the defaults so one odd reading doesn't stick forever.
    const k = 1 - Math.exp(-0.03 * dt);
    this.min += (HAND_MAPPING.sizeFar - this.min) * k;
    this.max += (HAND_MAPPING.sizeNear - this.max) * k;
    this.min = Math.min(this.min, size);
    this.max = Math.max(this.max, size);
    if (this.max - this.min < HAND_MAPPING.minSizeRange) this.max = this.min + HAND_MAPPING.minSizeRange;
  },
};

const _ndc = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _offset = new THREE.Vector3();

export class TrackedHand implements Grabber {
  readonly id: string;
  readonly color: THREE.Color;
  readonly joints: THREE.Vector3[] = Array.from({ length: NUM_LANDMARKS }, () => new THREE.Vector3());
  readonly point = new THREE.Vector3();
  readonly pinch = new PinchDetector();

  /** Raw apparent hand size (fraction of image height). */
  size = 0;
  /** Smoothed distance from the camera along the view axis. */
  depth = 0;
  /** Last time (ms) the hand was seen by the detector. */
  lastSeen = -Infinity;
  active = false;

  private readonly depthFilter = new OneEuroFilter(0.6, 0.4, 1.0);
  private readonly jointFilters = Array.from({ length: NUM_LANDMARKS }, () => new OneEuroFilter3(1.4, 2.5, 1.0));

  constructor(readonly handedness: Handedness) {
    this.id = handedness;
    this.color = new THREE.Color(HAND_COLORS[handedness]);
  }

  get pinching(): boolean {
    return this.active && this.pinch.pinching;
  }

  /** Feed a fresh detection. */
  update(hand: DetectedHand, aspect: number, camera: THREE.PerspectiveCamera, nowMs: number): void {
    const lm = hand.landmarks;
    const t = nowMs / 1000;

    if (!this.active) this.resetFilters();
    this.active = true;
    this.lastSeen = nowMs;

    this.pinch.update(lm, aspect);

    // --- Depth from apparent hand size --------------------------------------
    this.size = handSize(lm, aspect);
    depthCalibration.observe(this.size, t);
    const s = THREE.MathUtils.clamp(
      (this.size - depthCalibration.min) / (depthCalibration.max - depthCalibration.min),
      0,
      1,
    );
    const { distNear, distFar } = HAND_MAPPING;
    const rawDepth = HAND_MAPPING.reachIn ? THREE.MathUtils.lerp(distNear, distFar, s) : THREE.MathUtils.lerp(distFar, distNear, s);
    this.depth = this.depthFilter.filter(rawDepth, t);

    // --- Anchor: middle knuckle projected along the camera ray ---------------
    const anchor = lm[LM.MIDDLE_MCP];
    const anchorWorld = projectToWorld(anchor, camera, this.depth, new THREE.Vector3());

    // --- Joints at a fixed world scale around the anchor ---------------------
    const worldPerUnit = HAND_MAPPING.palmLength / Math.max(this.size, 1e-4);
    const zSign = HAND_MAPPING.reachIn ? 1 : -1;
    for (let i = 0; i < NUM_LANDMARKS; i++) {
      const p = lm[i];
      _offset
        .set(
          -(p.x - anchor.x) * aspect, // mirrored x
          -(p.y - anchor.y), // image y points down
          zSign * (p.z - anchor.z) * aspect, // MediaPipe z: negative = towards webcam
        )
        .multiplyScalar(worldPerUnit)
        .applyQuaternion(camera.quaternion);
      const j = this.joints[i].copy(anchorWorld).add(_offset);
      this.jointFilters[i].filter(j, t);
    }

    this.point.copy(this.joints[LM.THUMB_TIP]).add(this.joints[LM.INDEX_TIP]).multiplyScalar(0.5);
  }

  /**
   * Call when a fresh detection result did not include this hand. The hand is
   * only dropped after it has been missing for a while, so single-frame
   * dropouts don't release a held item.
   */
  markMissing(nowMs: number): void {
    if (this.active && nowMs - this.lastSeen > HAND_MAPPING.lostTimeoutMs) {
      this.active = false;
      this.pinch.reset();
    }
  }

  private resetFilters(): void {
    this.depthFilter.reset();
    for (const f of this.jointFilters) f.reset();
    this.pinch.reset();
  }
}

/** Projects a normalised (un-mirrored) image point into the scene at `depth` along the camera's view axis. */
function projectToWorld(
  p: NormalizedLandmark,
  camera: THREE.PerspectiveCamera,
  depth: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const g = HAND_MAPPING.gain;
  _ndc.set(
    THREE.MathUtils.clamp((1 - p.x - 0.5) * 2 * g, -1.1, 1.1),
    THREE.MathUtils.clamp(-(p.y - 0.5) * 2 * g, -1.1, 1.1),
    0.5,
  );
  _dir.copy(_ndc).unproject(camera).sub(camera.position).normalize();
  camera.getWorldDirection(_fwd);
  const along = depth / Math.max(_dir.dot(_fwd), 0.2);
  return out.copy(camera.position).addScaledVector(_dir, along);
}
