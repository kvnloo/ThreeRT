// Unknown material keys must not become properties, matching three.js r187.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

test("Material.setValues ignores unknown keys for Basic, Phong, and Lambert materials", () => {
  for (const material of [
    new THREE.MeshBasicMaterial(),
    new THREE.MeshPhongMaterial(),
    new THREE.MeshLambertMaterial(),
  ]) {
    assert.equal(material.opacity, 1);
    material.setValues({ opacity: 0.375, missingThreeProperty: 99 } as never);
    assert.equal(material.opacity, 0.375);
    assert.equal("missingThreeProperty" in material, false);
  }
});
