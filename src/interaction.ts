// Grab / hover / release logic shared by tracked hands and the mouse.

import * as THREE from 'three';
import { INTERACTION, STORE } from './config';
import type { Grabber } from './grabber';
import type { Physics } from './physics';
import { setHighlight, type Product } from './products';
import type { BasketZone } from './scene';

interface Held {
  index: number;
  /** Product position relative to the grab point, captured at grab time. */
  offset: THREE.Vector3;
  rotation: THREE.Quaternion;
}

interface Sample {
  t: number;
  p: THREE.Vector3;
}

interface GrabberState {
  wasPinching: boolean;
  held: Held | null;
  hover: number | null;
  history: Sample[];
}

const HOVER_COLOR_INTENSITY = 0.3;
const HOLD_COLOR_INTENSITY = 0.45;

export class Interaction {
  private readonly states = new Map<string, GrabberState>();
  /** Which grabber (if any) holds each product. */
  private readonly heldBy: (string | null)[];
  private readonly highlightKey: string[];
  basketCount = 0;

  private readonly _target = new THREE.Vector3();
  private readonly _vel = new THREE.Vector3();

  constructor(
    private readonly products: Product[],
    private readonly physics: Physics,
    private readonly basket: BasketZone,
  ) {
    this.heldBy = products.map(() => null);
    this.highlightKey = products.map(() => '');
  }

  state(id: string): GrabberState {
    let s = this.states.get(id);
    if (!s) {
      s = { wasPinching: false, held: null, hover: null, history: [] };
      this.states.set(id, s);
    }
    return s;
  }

  heldIndex(id: string): number | null {
    return this.states.get(id)?.held?.index ?? null;
  }

  update(grabbers: Grabber[], nowMs: number): void {
    for (const g of grabbers) {
      const s = this.state(g.id);

      if (!g.active) {
        // Tracking lost: drop whatever was held, without a throw.
        if (s.held) this.release(g.id, false);
        s.wasPinching = false;
        s.hover = null;
        s.history.length = 0;
        continue;
      }

      this.recordHistory(s, g.point, nowMs);
      const pinching = g.pinching;
      const started = pinching && !s.wasPinching;
      const ended = !pinching && s.wasPinching;
      s.wasPinching = pinching;

      if (s.held) {
        if (ended) {
          this.release(g.id, true);
        } else {
          this.followHand(g, s.held);
        }
        s.hover = null;
        continue;
      }

      const candidate = this.findCandidate(g);
      // While pinching on empty air we don't hover — a pinch must start near an item.
      s.hover = pinching && !started ? null : candidate;
      if (started && candidate !== null) this.grab(g, candidate);
    }

    this.updateHighlights(grabbers);
    this.countBasket();
  }

  private findCandidate(g: Grabber): number | null {
    if (g.preferredTarget !== undefined) {
      const t = g.preferredTarget;
      return t !== null && this.heldBy[t] !== g.id ? t : null;
    }
    let best: number | null = null;
    let bestDist = INTERACTION.grabRadius;
    for (const p of this.products) {
      if (this.heldBy[p.index] === g.id) continue;
      // Distance to an approximate surface (shrink the bounding sphere a bit since it overestimates).
      const d = g.point.distanceTo(p.object.position) - p.boundingRadius * 0.7;
      if (d < bestDist) {
        bestDist = d;
        best = p.index;
      }
    }
    return best;
  }

  private grab(g: Grabber, index: number): void {
    const product = this.products[index];
    const previousHolder = this.heldBy[index];
    if (previousHolder) {
      // Hand-to-hand pass: the other hand lets go, this one takes over. The body stays kinematic.
      this.state(previousHolder).held = null;
    } else {
      this.physics.grab(index);
    }
    const offset = g.holdAtPoint ? new THREE.Vector3() : product.object.position.clone().sub(g.point);
    offset.clampLength(0, product.boundingRadius);
    this.state(g.id).held = { index, offset, rotation: product.object.quaternion.clone() };
    this.heldBy[index] = g.id;
  }

  private followHand(g: Grabber, held: Held): void {
    const t = this._target.copy(g.point).add(held.offset);
    // Keep held items inside the room so they can't be dragged through the floor or walls.
    const r = this.products[held.index].boundingRadius * 0.5;
    t.x = THREE.MathUtils.clamp(t.x, -STORE.sideWallX + r, STORE.sideWallX - r);
    t.y = THREE.MathUtils.clamp(t.y, r, 3);
    t.z = THREE.MathUtils.clamp(t.z, STORE.backWallZ + r, STORE.frontWallZ - r);
    this.physics.moveKinematic(held.index, t, held.rotation);
  }

  private release(id: string, withVelocity: boolean): void {
    const s = this.state(id);
    if (!s.held) return;
    const index = s.held.index;
    const v = this._vel.set(0, 0, 0);
    if (withVelocity) this.estimateVelocity(s.history, v);
    this.physics.release(index, v);
    this.heldBy[index] = null;
    s.held = null;
  }

  private recordHistory(s: GrabberState, p: THREE.Vector3, nowMs: number): void {
    const last = s.history[s.history.length - 1];
    if (last && last.t === nowMs) return;
    s.history.push({ t: nowMs, p: p.clone() });
    const cutoff = nowMs - INTERACTION.velocityWindowMs;
    while (s.history.length > 2 && s.history[0].t < cutoff) s.history.shift();
  }

  private estimateVelocity(history: Sample[], out: THREE.Vector3): void {
    if (history.length < 2) return;
    const a = history[0];
    const b = history[history.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.02) return;
    out.copy(b.p).sub(a.p).divideScalar(dt).multiplyScalar(INTERACTION.throwScale);
    out.clampLength(0, INTERACTION.maxThrowSpeed);
  }

  private updateHighlights(grabbers: Grabber[]): void {
    const colorById = new Map(grabbers.map((g) => [g.id, g.color]));
    const hoverBy: (string | null)[] = this.products.map(() => null);
    for (const [id, s] of this.states) if (s.hover !== null) hoverBy[s.hover] = id;

    for (const p of this.products) {
      const holder = this.heldBy[p.index];
      const hover = hoverBy[p.index];
      const key = holder ? `h:${holder}` : hover ? `o:${hover}` : '';
      if (key === this.highlightKey[p.index]) continue;
      this.highlightKey[p.index] = key;
      if (holder) setHighlight(p, colorById.get(holder) ?? null, HOLD_COLOR_INTENSITY);
      else if (hover) setHighlight(p, colorById.get(hover) ?? null, HOVER_COLOR_INTENSITY);
      else setHighlight(p, null);
    }
  }

  private countBasket(): void {
    let n = 0;
    for (const p of this.products) {
      if (this.heldBy[p.index] === null && this.basket.bounds.containsPoint(p.object.position)) n++;
    }
    this.basketCount = n;
  }

  /** Drop everything (used by reset). */
  releaseAll(): void {
    for (const s of this.states.values()) {
      s.held = null;
      s.hover = null;
      s.history.length = 0;
      // wasPinching is kept: a hand that is mid-pinch must open before grabbing again.
    }
    this.heldBy.fill(null);
  }
}
