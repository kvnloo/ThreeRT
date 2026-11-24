// Spherical, and Vector3.setFromSpherical / setFromSphericalCoords, as three.js r187 has them.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);

test("Spherical: defaults, set, copy, clone", () => {
  const s = new THREE.Spherical();
  assert.deepEqual([s.radius, s.phi, s.theta], [1, 0, 0]);
  const t = new THREE.Spherical(2, 0.5, 1.5);
  assert.equal(s.copy(t), s);
  assert.deepEqual([s.radius, s.phi, s.theta], [2, 0.5, 1.5]);
  const c = t.clone();
  assert.notEqual(c, t);
  assert.deepEqual([c.radius, c.phi, c.theta], [2, 0.5, 1.5]);
});

test("Spherical.setFromVector3: phi from +y, theta about y from +z", () => {
  const s = new THREE.Spherical().setFromVector3(new THREE.Vector3(0, 0, 3));
  close(s.radius, 3); close(s.phi, Math.PI / 2); close(s.theta, 0);
  s.setFromVector3(new THREE.Vector3(2, 0, 0));
  close(s.phi, Math.PI / 2); close(s.theta, Math.PI / 2);
  s.setFromCartesianCoords(0, -5, 0);
  close(s.radius, 5); close(s.phi, Math.PI);
  s.setFromVector3(new THREE.Vector3());
  assert.deepEqual([s.radius, s.phi, s.theta], [0, 0, 0]);
});

test("Vector3.setFromSpherical round-trips Spherical.setFromVector3", () => {
  const v = new THREE.Vector3(1, -2, 3);
  const s = new THREE.Spherical().setFromVector3(v);
  const w = new THREE.Vector3().setFromSpherical(s);
  assert.ok(w.distanceTo(v) < 1e-12);
  const u = new THREE.Vector3().setFromSphericalCoords(2, Math.PI / 2, Math.PI / 2);
  assert.ok(u.distanceTo(new THREE.Vector3(2, 0, 0)) < 1e-12);
});

test("Spherical.makeSafe keeps phi off the poles", () => {
  const s = new THREE.Spherical(1, 0, 0).makeSafe();
  close(s.phi, 0.000001);
  s.phi = Math.PI + 1;
  s.makeSafe();
  close(s.phi, Math.PI - 0.000001);
});
