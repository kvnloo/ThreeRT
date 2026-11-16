// three.js compatibility: Euler.order notifies, as three.js r187 has it (the snippet-level suite is three-compat.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

test("Euler.order: changing the order notifies and keeps Object3D.quaternion in sync", () => {
  const euler = new THREE.Euler(0.2, 0.3, 0.4);
  let changes = 0;
  euler._onChange = () => { changes++; };
  euler.order = "YXZ";
  assert.equal(changes, 1, "assigning order invokes the change callback once");
  euler.set(0.2, 0.3, 0.4, "ZXY");
  assert.equal(changes, 2, "set still invokes its callback just once");
  euler.setFromQuaternion(new THREE.Quaternion(), false);
  assert.equal(changes, 2, "the suppressed quaternion conversion does not invoke a callback");

  const object = new THREE.Object3D();
  object.rotation.set(Math.PI / 2, Math.PI / 2, 0, "XYZ");
  assert.ok(Math.abs(object.quaternion.z - 0.5) < 1e-12, "XYZ begins with +0.5 z");
  object.rotation.order = "YXZ";
  const expected = [0.5, 0.5, -0.5, 0.5];
  assert.ok(object.quaternion.toArray().every((value, i) => Math.abs(value - expected[i]) < 1e-12),
    "YXZ recomposes the quaternion to (0.5, 0.5, -0.5, 0.5)");
  assert.equal(object.rotation.order, "YXZ", "setting the order preserves the chosen order");
});
