// LatheGeometry, as three.js r187 has it: the same positions, uvs, index and (smooth, seam-continuous) normals, and
// the profile kept in parameters.points.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";
import * as REF from "three";

const r = (a: ArrayLike<number>) => Array.from(a, (x) => +x.toFixed(5) || 0);

function arrays(g: THREE.BufferGeometry | REF.BufferGeometry) {
  return {
    position: r(g.getAttribute("position")!.array),
    normal: r(g.getAttribute("normal")!.array),
    uv: r(g.getAttribute("uv")!.array),
    index: Array.from(g.getIndex()!.array),
  };
}

test("LatheGeometry matches three.js r187", () => {
  const profile = [[0, -1], [0.6, -0.8], [0.9, 0], [0.4, 0.5], [0.45, 1.2], [0, 1.3]];
  for (const [segments, phiStart, phiLength] of [[12, 0, Math.PI * 2], [5, 0.3, Math.PI], [7.6, -1, 9]]) {
    const ours = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments, phiStart, phiLength);
    const ref = new REF.LatheGeometry(profile.map(([x, y]) => new REF.Vector2(x, y)), segments, phiStart, phiLength);
    assert.deepEqual(arrays(ours), arrays(ref), `segments ${segments}, phi ${phiStart} + ${phiLength}`);
  }
  assert.deepEqual(arrays(new THREE.LatheGeometry()), arrays(new REF.LatheGeometry()));
});

test("LatheGeometry: parameters keep the profile, and the seam's normals agree", () => {
  const points = [new THREE.Vector2(0.5, -1), new THREE.Vector2(1, 0), new THREE.Vector2(0.5, 1)];
  const g = new THREE.LatheGeometry(points, 8);
  assert.equal(g.parameters.points, points);
  assert.equal(g.parameters.segments, 8);
  const n = g.getAttribute("normal")!;
  const first = 0, seam = 8 * points.length; // the same profile point at phi = 0 and at phi = 2π
  for (let j = 0; j < points.length; j++) {
    assert.ok(Math.abs(n.getX(first + j) - n.getX(seam + j)) < 1e-6 && Math.abs(n.getY(first + j) - n.getY(seam + j)) < 1e-6 && Math.abs(n.getZ(first + j) - n.getZ(seam + j)) < 1e-6);
  }
});
