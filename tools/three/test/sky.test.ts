// The sky inputs the three.js adapter ports from the native renderer (tools/three/sky.ts): the gradient dome's
// anchors, the equirect layout three.js samples, and the atmosphere's transmittance toward the sun.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bakeEquirect, type GradientDesc, gradientRadiance, sunTransmittance, type V3 } from "../sky.ts";

const near = (a: number[], b: number[], eps = 1e-9) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < eps, `${a} vs ${b}`));
const unit = (v: V3): V3 => {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
};
const g: GradientDesc = { zenith: [0.1, 0.2, 0.8], horizon: [0.6, 0.6, 0.5], ground: [0.2, 0.15, 0.1], intensity: 2 };

test("gradient: zenith, horizon and ground colours scaled by the intensity", () => {
  near(gradientRadiance(g, [0, 1, 0], null), [0.2, 0.4, 1.6]);
  near(gradientRadiance(g, [1, 0, 0], null), [1.2, 1.2, 1.0]);
  near(gradientRadiance(g, [0, -1, 0], null), [0.4, 0.3, 0.2]);
  // The ground blends up into the horizon over 0.08 of d.y: half way at d.y = -0.04, continuous at the horizon.
  near(gradientRadiance(g, [Math.sqrt(1 - 0.04 ** 2), -0.04, 0], null), [0.8, 0.75, 0.6], 1e-9);
  const just = gradientRadiance(g, unit([1, -1e-6, 0]), null);
  near(just, [1.2, 1.2, 1.0], 1e-4);
});

test("gradient: a glow adds at the horizon and fades toward the zenith", () => {
  const glow = { ...g, glow: { color: [1, 0.5, 0] as V3, intensity: 1, height: 0.2 } };
  near(gradientRadiance(glow, [1, 0, 0], null), [1.2 + 2, 1.2 + 1, 1.0]);
  const z = gradientRadiance(glow, [0, 1, 0], null), k = Math.exp(-Math.PI / 2 / 0.2);
  near(z, [0.2 + 2 * k, 0.4 + k, 1.6]);
});

test("gradient (horizon exponent, UE M_NightSky): zenith straight up, horizon at and below the horizon", () => {
  const night = { ...g, horizonExponent: 4 };
  near(gradientRadiance(night, [0, 1, 0], null), [0.2, 0.4, 1.6]);
  near(gradientRadiance(night, [0, 0, 1], null), [1.2, 1.2, 1.0]);
  near(gradientRadiance(night, [0, -1, 0], null), [1.2, 1.2, 1.0]);
  // Half way up: (1 - 0.5)^4 of the way to the horizon.
  const t = 0.5 ** 4;
  near(gradientRadiance(night, unit([0, 0.5, Math.sqrt(0.75)]), null), [0.2 + t, 0.4 + 0.8 * t, 1.6 - 0.6 * t], 1e-9);
});

test("bakeEquirect: texel directions follow three.js equirectUv, row 0 at the bottom", () => {
  const w = 16, h = 8;
  const dirs: V3[] = [];
  const px = bakeEquirect(w, h, (d) => (dirs.push(d), d));
  assert.equal(px.length, w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, d: V3 = [px[o], px[o + 1], px[o + 2]];
      assert.equal(px[o + 3], 1);
      assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-6);
      // three.js: u = atan(d.z, d.x) / 2pi + 0.5, v = asin(d.y) / pi + 0.5, sampled at texel centres.
      const u = Math.atan2(d[2], d[0]) / (2 * Math.PI) + 0.5, v = Math.asin(d[1]) / Math.PI + 0.5;
      assert.ok(Math.abs(u - (x + 0.5) / w) < 1e-6, `u at ${x},${y}`);
      assert.ok(Math.abs(v - (y + 0.5) / h) < 1e-6, `v at ${x},${y}`);
    }
  }
  assert.ok(px[1] < 0 && px[((h - 1) * w) * 4 + 1] > 0, "bottom row looks down, top row up");
});

test("sunTransmittance: in (0, 1), reddest low, more light with the sun higher", () => {
  const at = (deg: number) => sunTransmittance([Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0]);
  let prev: V3 = [0, 0, 0];
  for (const deg of [2, 5, 10, 30, 60, 90]) {
    const t = at(deg);
    for (let k = 0; k < 3; k++) {
      assert.ok(t[k] > 0 && t[k] < 1, `${deg}: ${t}`);
      assert.ok(t[k] > prev[k], `${deg} degrees lets through more than lower`);
    }
    assert.ok(t[0] > t[1] && t[1] > t[2], `${deg}: Rayleigh takes blue first (${t})`);
    prev = t;
  }
  // Only the elevation matters, not the azimuth.
  near(sunTransmittance(unit([0, 0.5, 1])), sunTransmittance(unit([-1, 0.5, 0])), 1e-12);
  // Scaling the Rayleigh or Mie densities up lets less through.
  const z = at(45), r = sunTransmittance(unit([1, 1, 0]), 2, 1), m = sunTransmittance(unit([1, 1, 0]), 1, 4);
  for (let k = 0; k < 3; k++) assert.ok(r[k] < z[k] && m[k] < z[k]);
});
