// three.js compatibility: InstancedMesh.setMatrixAt returns the mesh, as three.js r187 has it (the snippet-level suite is three-compat.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

test("InstancedMesh: setMatrixAt returns the mesh for chaining, as three.js does", () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 2);
  const translation = new THREE.Matrix4().makeTranslation(2, 3, 4);
  const result = mesh.setMatrixAt(1, translation);
  assert.equal(result, mesh, "setMatrixAt returns the mesh, not undefined");
  assert.deepEqual([...mesh.getMatrixAt(1, new THREE.Matrix4()).elements], [...translation.elements], "instance 1 receives its matrix");
  assert.deepEqual([...mesh.getMatrixAt(0, new THREE.Matrix4()).elements], [...new THREE.Matrix4().elements], "instance 0 stays the identity");
  const version = mesh.instanceMatrix.version;
  mesh.instanceMatrix.needsUpdate = true;
  assert.equal(mesh.instanceMatrix.version, version + 1, "the required upload flag still works");
});

test("InstancedMesh: setColorAt returns the mesh, and dispose fires dispose, as three.js does", () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 2);
  assert.equal(mesh.setColorAt(1, new THREE.Color(1, 0, 0)), mesh, "setColorAt chains");
  assert.deepEqual(mesh.getColorAt(1, new THREE.Color()).toArray(), [1, 0, 0]);
  assert.equal(mesh.setCustomDataAt(0, [1, 2, 3, 4]), mesh, "setCustomDataAt chains too");
  let fired: unknown = null;
  mesh.addEventListener("dispose", (e) => (fired = e.target));
  assert.equal(mesh.dispose(), mesh);
  assert.equal(fired, mesh, "dispose event with the mesh as target");
});
