// three.js compatibility: Object3D.uuid, as three.js r187 has it (the snippet-level suite is three-compat.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

test("Object3D: UUID lookup and copy/clone preserve independent identities, as three.js does", () => {
  // The optional shape lets this regression compile on main, where Object3D has no uuid.
  const uuidOf = (object: THREE.Object3D) => (object as THREE.Object3D & { uuid?: string }).uuid ?? "";
  const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const source = new THREE.Group();
  const child = new THREE.Object3D();
  source.name = "search-root";
  child.name = "search-child";
  source.userData = { options: { enabled: true } };
  source.add(child);

  assert.match(uuidOf(source), v4, "every Object3D has a version-4 UUID");
  assert.match(uuidOf(child), v4);
  assert.notEqual(uuidOf(source), uuidOf(child));
  assert.equal(source.getObjectByProperty("uuid", uuidOf(child)), child);
  assert.equal(source.getObjectById(child.id), child);
  assert.equal(source.getObjectByName("search-child"), child);

  const destination = new THREE.Group();
  const ownId = destination.id;
  const ownUUID = uuidOf(destination);
  assert.match(ownUUID, v4);
  assert.equal(destination.copy(source, false), destination);
  assert.equal(destination.id, ownId, "copy keeps the destination ID");
  assert.equal(uuidOf(destination), ownUUID, "copy keeps the destination UUID");
  assert.notEqual(uuidOf(destination), uuidOf(source));
  assert.equal(destination.name, source.name);
  assert.deepEqual(destination.userData, source.userData);
  assert.notStrictEqual(destination.userData, source.userData);

  const cloned = source.clone();
  assert.match(uuidOf(cloned), v4);
  assert.notEqual(cloned.id, source.id);
  assert.notEqual(uuidOf(cloned), uuidOf(source));
  assert.equal(cloned.name, source.name);
  assert.deepEqual(cloned.userData, source.userData);
  assert.notStrictEqual(cloned.userData, source.userData);
  assert.equal(cloned.children.length, 1);
  assert.match(uuidOf(cloned.children[0]), v4);
  assert.notEqual(uuidOf(cloned.children[0]), uuidOf(child));
});
