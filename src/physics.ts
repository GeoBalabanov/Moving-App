// Rapier physics: static store colliders, one rigid body per product, and the
// dynamic ⇄ kinematic switching used for grabbing.

import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PHYSICS } from './config';
import type { Product } from './products';
import type { StaticBox } from './scene';

export class Physics {
  private world!: RAPIER.World;
  private bodies: RAPIER.RigidBody[] = [];
  private accumulator = 0;
  /** Number of fixed steps run in the last update (for debugging). */
  lastSteps = 0;

  constructor(private readonly products: Product[]) {}

  async init(staticBoxes: StaticBox[]): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.timestep;

    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const box of staticBoxes) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(box.size.x / 2, box.size.y / 2, box.size.z / 2)
          .setTranslation(box.center.x, box.center.y, box.center.z)
          .setFriction(0.8),
        ground,
      );
    }

    for (const p of this.products) {
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.homePosition.x, p.homePosition.y, p.homePosition.z)
        .setRotation(p.homeQuaternion)
        .setCcdEnabled(true)
        .setLinearDamping(0.05)
        .setAngularDamping(0.3)
        // Letters with round or slanted bottoms would tip over on their own, so on
        // the shelf they stay upright (they can still slide when pushed) until grabbed.
        .lockRotations();
      const body = this.world.createRigidBody(desc);
      let collider: RAPIER.ColliderDesc;
      switch (p.shape.type) {
        case 'box': {
          const h = p.shape.halfExtents;
          collider = RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z);
          break;
        }
        case 'convex': {
          // Convex hull of the glyph; fall back to its bounding box if hull building fails.
          const h = p.shape.halfExtents;
          collider = RAPIER.ColliderDesc.convexHull(p.shape.points) ?? RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z);
          break;
        }
      }
      collider.setDensity(p.density).setFriction(0.7).setRestitution(0.15);
      this.world.createCollider(collider, body);
      this.bodies.push(body);
    }
  }

  /** Advance the simulation with a fixed timestep and sync product meshes. */
  update(dt: number): void {
    this.accumulator = Math.min(this.accumulator + dt, PHYSICS.timestep * PHYSICS.maxSubsteps);
    let steps = 0;
    while (this.accumulator >= PHYSICS.timestep) {
      this.world.step();
      this.accumulator -= PHYSICS.timestep;
      steps++;
    }
    this.lastSteps = steps;

    for (let i = 0; i < this.products.length; i++) {
      const body = this.bodies[i];
      const obj = this.products[i].object;
      const t = body.translation();
      const r = body.rotation();
      obj.position.set(t.x, t.y, t.z);
      obj.quaternion.set(r.x, r.y, r.z, r.w);

      // Safety net: anything that escapes the store goes back home.
      if (t.y < -2 || Math.abs(t.x) > 10 || Math.abs(t.z) > 10) this.resetProduct(i);
    }
  }

  /** Switch to kinematic so the body follows the hand exactly but still pushes others. */
  grab(index: number): void {
    const body = this.bodies[index];
    body.lockRotations(false, true);
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  moveKinematic(index: number, position: THREE.Vector3, rotation: THREE.Quaternion): void {
    const body = this.bodies[index];
    body.setNextKinematicTranslation(position);
    body.setNextKinematicRotation(rotation);
  }

  /** Back to dynamic, carrying the hand's velocity so items can be tossed. */
  release(index: number, velocity: THREE.Vector3): void {
    const body = this.bodies[index];
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.setLinvel(velocity, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  isSleeping(index: number): boolean {
    return this.bodies[index].isSleeping();
  }

  speed(index: number): number {
    const v = this.bodies[index].linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  resetProduct(index: number): void {
    const body = this.bodies[index];
    const p = this.products[index];
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.setTranslation(p.homePosition, true);
    body.setRotation(p.homeQuaternion, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.lockRotations(true, true);
    p.object.position.copy(p.homePosition);
    p.object.quaternion.copy(p.homeQuaternion);
  }

  resetAll(): void {
    for (let i = 0; i < this.products.length; i++) this.resetProduct(i);
    this.accumulator = 0;
  }
}
