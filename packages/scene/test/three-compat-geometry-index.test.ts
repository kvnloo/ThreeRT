// BufferGeometry index array-width parity with three.js r187.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

test("BufferGeometry.setIndex chooses Uint16 or Uint32 for a plain array as three.js r187 does", () => {
  const geometry = new THREE.BufferGeometry();
  assert.equal(geometry.getIndex(), null, "new geometries have no index");
  assert.equal(geometry.setIndex([0, 1, 65534]), geometry, "setIndex returns this");
  assert.ok(geometry.getIndex()!.array instanceof Uint16Array, "65534 uses Uint16");
  assert.deepEqual([...geometry.getIndex()!.array], [0, 1, 65534]);

  geometry.setIndex([0, 1, 65535]);
  assert.ok(geometry.getIndex()!.array instanceof Uint32Array, "65535 is the primitive restart boundary");
  assert.deepEqual([...geometry.getIndex()!.array], [0, 1, 65535]);

  geometry.setIndex([0, 1, 65536]);
  assert.ok(geometry.getIndex()!.array instanceof Uint32Array, "65536 uses Uint32");

  geometry.setIndex(new THREE.Uint32BufferAttribute([0, 1, 2], 1));
  assert.ok(geometry.getIndex()!.array instanceof Uint32Array, "an explicit Uint32 attribute remains Uint32");

  assert.equal(geometry.setIndex(null), geometry, "clearing returns this");
  assert.equal(geometry.getIndex(), null, "null clears the index");
});
