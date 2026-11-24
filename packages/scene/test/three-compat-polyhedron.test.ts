// PolyhedronGeometry and its four solids, as three.js r187 has them: the same positions, normals and uvs, with v
// running up and three's corrections at the u seam and the poles.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";
import * as REF from "three";

const r = (a: ArrayLike<number>) => Array.from(a, (x) => +x.toFixed(5) || 0);
function arrays(g: THREE.BufferGeometry | REF.BufferGeometry) {
  return { position: r(g.getAttribute("position")!.array), normal: r(g.getAttribute("normal")!.array), uv: r(g.getAttribute("uv")!.array) };
}

test("Icosahedron, Octahedron, Tetrahedron and Dodecahedron geometries match three.js r187", () => {
  for (const name of ["IcosahedronGeometry", "OctahedronGeometry", "TetrahedronGeometry", "DodecahedronGeometry"] as const) {
    for (const [radius, detail] of [[1, 0], [2.5, 1], [0.75, 3]]) {
      const ours = new THREE[name](radius, detail), ref = new REF[name](radius, detail);
      assert.deepEqual(arrays(ours), arrays(ref), `${name}(${radius}, ${detail})`);
      assert.deepEqual(ours.parameters, ref.parameters);
    }
  }
});

test("PolyhedronGeometry: a custom solid matches three.js r187 and keeps its vertices and indices", () => {
  const vertices = [1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1, 0, 2, 0];
  const indices = [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1, 4, 0, 2];
  const ours = new THREE.PolyhedronGeometry(vertices, indices, 3, 2);
  const ref = new REF.PolyhedronGeometry(vertices, indices, 3, 2);
  assert.deepEqual(arrays(ours), arrays(ref));
  assert.deepEqual(ours.parameters, { vertices, indices, radius: 3, detail: 2 });
});

test("OctahedronGeometry: v is 1 at the top pole, and no triangle's u spans the seam", () => {
  const g = new THREE.OctahedronGeometry(1, 2);
  const pos = g.getAttribute("position")!, uv = g.getAttribute("uv")!;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.999) assert.ok(Math.abs(uv.getY(i) - 1) < 1e-9);
  for (let i = 0; i < uv.count; i += 3) {
    const us = [uv.getX(i), uv.getX(i + 1), uv.getX(i + 2)];
    assert.ok(Math.max(...us) - Math.min(...us) < 0.5, `triangle ${i / 3}: u ${us}`);
  }
});
