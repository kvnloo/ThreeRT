// three.js r187: setHSL and getHSL default to the linear working color space.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

test("Color HSL defaults to linear RGB, including grey, round trip, and hue wrap", () => {
  const grey = new THREE.Color().setHSL(-1 / 3, 0, 0.5);
  assert.deepEqual(grey.toArray(), [0.5, 0.5, 0.5], "zero saturation gives half-intensity linear grey");

  const greyHSL = new THREE.Color().setRGB(0.5, 0.5, 0.5).getHSL({ h: -1, s: -1, l: -1 });
  assert.deepEqual(greyHSL, { h: 0, s: 0, l: 0.5 }, "getHSL reads linear working-space channels");

  const yellow = new THREE.Color().setHSL(1 / 6, 1, 0.25);
  assert.ok(Math.abs(yellow.r - 0.5) < 1e-12);
  assert.ok(Math.abs(yellow.g - 0.5) < 1e-12);
  assert.ok(Math.abs(yellow.b) < 1e-12);

  const roundTrip = yellow.getHSL({ h: 0, s: 0, l: 0 });
  assert.ok(Math.abs(roundTrip.h - 1 / 6) < 1e-12);
  assert.ok(Math.abs(roundTrip.s - 1) < 1e-12);
  assert.ok(Math.abs(roundTrip.l - 0.25) < 1e-12);

  const wrapped = new THREE.Color().setHSL(1 + 1 / 6, 1, 0.25);
  assert.ok(Math.abs(wrapped.r - yellow.r) < 1e-12);
  assert.ok(Math.abs(wrapped.g - yellow.g) < 1e-12);
  assert.ok(Math.abs(wrapped.b - yellow.b) < 1e-12);
});
