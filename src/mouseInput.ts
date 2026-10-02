// Mouse fallback: click-and-drag products without a camera. While dragging,
// the item glides over whatever surface is under the cursor (shelf, counter,
// basket…), so you can drop it anywhere you can see. Flick to toss.

import * as THREE from 'three';
import type { Grabber } from './grabber';
import type { Product } from './products';

const _normal = new THREE.Vector3();

export class MouseGrabber implements Grabber {
  readonly id = 'mouse';
  readonly color = new THREE.Color('#ffd23f');
  readonly point = new THREE.Vector3(0, -100, 0);
  readonly holdAtPoint = true;
  active = false;
  pinching = false;
  preferredTarget: number | null = null;

  private readonly ndc = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private hasPointer = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly products: Product[],
    /** Static scene meshes the dragged item can rest on. */
    private readonly surfaces: THREE.Object3D[],
  ) {
    canvas.addEventListener('pointermove', (e) => this.setPointer(e));
    canvas.addEventListener('pointerenter', (e) => this.setPointer(e));
    canvas.addEventListener('pointerleave', () => {
      if (!this.pinching) this.hasPointer = false;
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.setPointer(e);
      canvas.setPointerCapture(e.pointerId);
      const hit = this.raycast(this.products.map((p) => p.object));
      this.preferredTarget = hit ? (hit.object.userData.productIndex ?? null) : null;
      this.pinching = true;
    });
    const end = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      this.pinching = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  private setPointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.hasPointer = true;
  }

  private raycast(objects: THREE.Object3D[]): THREE.Intersection | null {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.intersectObjects(objects, true)[0] ?? null;
  }

  /** Call once per frame before the interaction update. */
  update(heldIndex: number | null): void {
    this.active = this.hasPointer;
    if (!this.active) return;

    if (this.pinching && heldIndex !== null) {
      // Rest the held item on the first surface (or other product) under the cursor.
      const held = this.products[heldIndex];
      const others = this.products.filter((p) => p.index !== heldIndex).map((p) => p.object);
      const hit = this.raycast([...this.surfaces, ...others]);
      if (hit) {
        _normal.copy(hit.face?.normal ?? THREE.Object3D.DEFAULT_UP).transformDirection(hit.object.matrixWorld);
        this.point.copy(hit.point).addScaledVector(_normal, held.boundingRadius * 0.85 + 0.01);
      }
      return;
    }

    const hit = this.raycast(this.products.map((p) => p.object));
    if (hit) {
      this.point.copy(hit.point);
      if (!this.pinching) this.preferredTarget = hit.object.userData.productIndex ?? null;
    } else {
      this.point.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, 50);
      if (!this.pinching) this.preferredTarget = null;
    }
  }
}
