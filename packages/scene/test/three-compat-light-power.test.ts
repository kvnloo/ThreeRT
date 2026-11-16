// Three.js r187 light power converts candela and nits into lumens.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../src/index.ts";

test("Light.power: point, spot, and rectangle use the three.js luminous-power conversions", () => {
  const close = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-12, `expected ${expected}, got ${actual}`);

  const point = new THREE.PointLight(0xffffff, 2);
  close(point.power, 8 * Math.PI);
  point.power = 12 * Math.PI;
  close(point.intensity, 3);
  close(point.power, 12 * Math.PI);

  const spot = new THREE.SpotLight(0xffffff, 2);
  close(spot.power, 2 * Math.PI);
  spot.power = 15 * Math.PI;
  close(spot.intensity, 15);
  close(spot.power, 15 * Math.PI);

  const area = new THREE.RectAreaLight(0xffffff, 2, 3, 4);
  close(area.power, 24 * Math.PI);
  area.power = 36 * Math.PI;
  close(area.intensity, 3);
  area.width = 6;
  close(area.power, 72 * Math.PI);
  area.power = 18 * Math.PI;
  close(area.intensity, 0.75);
});
