// Gesture detection from MediaPipe landmarks.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PINCH } from './config';

export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  PINKY_MCP: 17,
} as const;

/** 3D distance between two landmarks in "image height" units (x is corrected for aspect ratio). */
export function landmarkDistance(a: NormalizedLandmark, b: NormalizedLandmark, aspect: number): number {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  const dz = (a.z - b.z) * aspect; // MediaPipe z uses roughly the same scale as x
  return Math.hypot(dx, dy, dz);
}

/** Apparent size of the hand: wrist → middle-finger knuckle. Bigger = closer to the webcam. */
export function handSize(landmarks: NormalizedLandmark[], aspect: number): number {
  return landmarkDistance(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP], aspect);
}

/**
 * Pinch detector with hysteresis: the pinch starts below `grab` and only ends
 * above `release`, so noise around a single threshold can't make it flicker.
 * The distance is normalised by hand size, so it works at any depth.
 */
export class PinchDetector {
  pinching = false;
  ratio = 1;

  constructor(
    private readonly grab = PINCH.grab,
    private readonly release = PINCH.release,
  ) {}

  update(landmarks: NormalizedLandmark[], aspect: number): boolean {
    const size = Math.max(handSize(landmarks, aspect), 1e-4);
    this.ratio = landmarkDistance(landmarks[LM.THUMB_TIP], landmarks[LM.INDEX_TIP], aspect) / size;
    if (this.pinching) {
      if (this.ratio > this.release) this.pinching = false;
    } else if (this.ratio < this.grab) {
      this.pinching = true;
    }
    return this.pinching;
  }

  reset(): void {
    this.pinching = false;
    this.ratio = 1;
  }
}
