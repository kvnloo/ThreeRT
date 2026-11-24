// three.js compatibility: what a Raycaster's mesh hit carries besides the face (three r187 Mesh.js
// checkGeometryIntersection): the vertex normal there, the barycentric coordinates and the second uv set.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

const close = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

// (Expected values are three r187's on the same scenes.)
test("Raycaster: a mesh hit has the geometry's normal interpolated at the point, in object space, and its barycoord", () => {
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial());
  sphere.position.set(0.5, 0, 0);
  sphere.rotation.y = 0.4;
  const h = new THREE.Raycaster(new THREE.Vector3(0.7, 0.3, 5), new THREE.Vector3(0, 0, -1)).intersectObject(sphere)[0];
  assert.equal(h.faceIndex, 26);
  assert.ok(Math.abs(h.distance - 4.1518238635745135) < 1e-9);
  assert.ok(close(h.normal!.toArray(), [-0.14608314623199165, 0.3, 0.8591056237673158]));
  assert.ok(close(h.barycoord!.toArray(), [0.3614472298221845, 0.23855277017781545, 0.4]));
  assert.equal(h.uv1, undefined, "no uv1 attribute, no uv1");
});

test("Raycaster: the hit's normal is turned to face the ray (the face's is not), and uv1 is interpolated", () => {
  const g = new THREE.PlaneGeometry(2, 2);
  g.setAttribute("uv1", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  const mat = new THREE.MeshStandardMaterial();
  mat.side = THREE.DoubleSide;
  const h = new THREE.Raycaster(new THREE.Vector3(0.3, 0.2, -5), new THREE.Vector3(0, 0, 1)).intersectObject(new THREE.Mesh(g, mat))[0];
  assert.ok(close(h.normal!.toArray(), [0, 0, -1]));
  assert.ok(close(h.face!.normal.toArray(), [0, 0, 1]));
  assert.ok(close(h.barycoord!.toArray(), [0.35, 0.05, 0.6]));
  assert.ok(close(h.uv1!.toArray(), [0.65, 0.4]));
});
