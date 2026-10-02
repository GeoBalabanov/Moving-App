import * as THREE from 'three';

/**
 * Anything that can grab products: a tracked hand or the mouse.
 * The interaction system only sees this interface.
 */
export interface Grabber {
  readonly id: string;
  /** Whether the grabber is currently tracked / on screen. */
  readonly active: boolean;
  /** Grab gesture held (pinch, or mouse button down). */
  readonly pinching: boolean;
  /** World-space grab point (between thumb and index tip, or under the mouse). */
  readonly point: THREE.Vector3;
  /** Highlight colour used for hover/hold feedback. */
  readonly color: THREE.Color;
  /** Optional: product the grabber is pointing straight at (mouse raycast). */
  readonly preferredTarget?: number | null;
  /** Hold items centred on `point` instead of keeping the grab offset (mouse dragging). */
  readonly holdAtPoint?: boolean;
}
