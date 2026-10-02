// Loads TrueType fonts with opentype.js and turns glyph outlines into
// extruded Three.js geometry (real type, not textures).

import { parse, type Font } from 'opentype.js';
import * as THREE from 'three';

const FONT_DIR = `${import.meta.env.BASE_URL}fonts/`;
const fontCache = new Map<string, Promise<Font>>();

export function loadFont(file: string): Promise<Font> {
  let p = fontCache.get(file);
  if (!p) {
    p = fetch(FONT_DIR + file)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load font ${file} (${r.status})`);
        return r.arrayBuffer();
      })
      .then((buf) => parse(buf));
    fontCache.set(file, p);
  }
  return p;
}

/** Registers the font for 2D canvas drawing (used for shelf labels). */
export async function registerCssFont(family: string, file: string): Promise<void> {
  const face = new FontFace(family, `url(${FONT_DIR}${file})`);
  await face.load();
  document.fonts.add(face);
}

function capHeight(font: Font): number {
  const os2 = font.tables.os2 as { sCapHeight?: number } | undefined;
  if (os2?.sCapHeight) return os2.sCapHeight;
  const bb = font.charToGlyph('H').getBoundingBox();
  return bb.y2 - bb.y1 || font.unitsPerEm * 0.7;
}

export interface GlyphGeometry {
  geometry: THREE.ExtrudeGeometry;
  /** Size of the centred geometry. */
  size: THREE.Vector3;
}

/**
 * Builds an extruded, centred glyph. `height` is the cap height in metres so
 * every typeface sits on the same visual scale (just like setting type at one point size).
 */
export function glyphGeometry(font: Font, char: string, height: number, depth: number): GlyphGeometry {
  const unitsToWorld = height / capHeight(font);
  // getPath uses a y-down coordinate system at the given font size; we flip y back up.
  const path = font.getPath(char, 0, 0, font.unitsPerEm * unitsToWorld);

  const shapePath = new THREE.ShapePath();
  for (const c of path.commands) {
    switch (c.type) {
      case 'M':
        shapePath.moveTo(c.x, -c.y);
        break;
      case 'L':
        shapePath.lineTo(c.x, -c.y);
        break;
      case 'Q':
        shapePath.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
        break;
      case 'C':
        shapePath.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
        break;
      case 'Z':
        shapePath.currentPath?.closePath();
        break;
    }
  }

  const shapes = shapePath.toShapes();
  const bevel = Math.min(depth * 0.12, height * 0.02);
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: depth - 2 * bevel,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelSegments: 2,
  });
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const center = bb.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeBoundingBox();
  return { geometry, size: geometry.boundingBox!.getSize(new THREE.Vector3()) };
}

/** Vertex positions (subsampled if very dense) for building a convex-hull collider. */
export function hullPoints(geometry: THREE.BufferGeometry, maxPoints = 3000): Float32Array {
  const pos = geometry.getAttribute('position');
  const stride = Math.max(1, Math.ceil(pos.count / maxPoints));
  const out: number[] = [];
  for (let i = 0; i < pos.count; i += stride) out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  return new Float32Array(out);
}
