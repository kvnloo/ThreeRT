// Headless CLI regression for upstream ThreeRT PR #74. The three catalog bundles
// are built before this test; unlike rendering, stats must need no display or GPU.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { VoxelGrid } from "@threert/voxel";
import { encodeProcAsset } from "../tools/lib/proc-asset.ts";
import { join, resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "..");
const binary = join(root, "renderer", "target", "release", process.platform === "win32" ? "threert-render.exe" : "threert-render");
const fields = [
  "objects", "geometries", "materials", "textures", "triangles",
  "flat_triangles", "instances", "instanced_triangles", "emitters",
] as const;
type Stats = Record<string, unknown>;
type Field = (typeof fields)[number];

function count(stats: Stats, field: Field): number {
  const value = stats[field];
  assert.ok(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, `${field}: expected a nonnegative integer, got ${String(value)}`);
  return value;
}

function readStats(scene: string, assets = root): Stats {
  const bundle = join(root, "out", "bundles", `${scene}.js`);
  assert.ok(existsSync(binary), `missing ${binary}: build the release renderer first`);
  assert.ok(existsSync(bundle), `missing ${bundle}: build that scene bundle before running this test`);

  // A displayless process must still characterise all three scenes.
  const result = spawnSync(binary, ["stats", bundle, "--assets", assets, "--room", "local", "--seed", "17"], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, DISPLAY: "", WAYLAND_DISPLAY: "" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${scene}: exit ${String(result.status)}, signal ${String(result.signal)}\n${result.stderr}\n${result.stdout}`);
  const stdout = result.stdout.trim();
  // Retain actual JSON as CI evidence, including on a subsequent assertion failure.
  console.log(`${scene}: ${stdout}`);
  const parsed: unknown = JSON.parse(stdout);
  assert.ok(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed), `${scene}: expected one JSON object`);
  return parsed as Stats;
}

for (const scene of ["cornell-box", "instancing", "sun-room"] as const) {
  test(`stats without a display: ${scene}`, () => {
    const first = readStats(scene);
    const again = readStats(scene);
    assert.equal(first.engine, "quickjs");
    for (const timing of ["bundle_load_ms", "setup_ms", "prepare_ms"]) {
      const value = first[timing];
      assert.ok(typeof value === "number" && Number.isFinite(value) && value >= 0, `${scene}: invalid ${timing}`);
    }
    for (const field of fields) {
      assert.equal(count(first, field), count(again, field), `${scene}: non-deterministic ${field}`);
    }
    assert.ok(count(first, "objects") > 0, `${scene}: no scene objects`);
    assert.equal(count(first, "triangles"), count(first, "flat_triangles") + count(first, "instanced_triangles"));

    if (scene === "cornell-box") {
      // Seven BoxGeometry meshes * 12 tris + RectAreaLight * 2 tris.
      assert.equal(count(first, "triangles"), 86);
      assert.equal(count(first, "flat_triangles"), 86);
      assert.equal(count(first, "instances"), 0);
      assert.equal(count(first, "emitters"), 2);
    } else if (scene === "instancing") {
      // 10^3 TorusKnotGeometry instances, 48 tubular * 8 radial * 2 tris.
      assert.equal(count(first, "instances"), 1_000);
      assert.equal(count(first, "instanced_triangles"), 768_000);
      assert.equal(count(first, "triangles"), 768_000);
      assert.equal(count(first, "emitters"), 0);
    } else {
      // The sun-room has an emissive cylinder shade, not merely an analytic sun.
      assert.ok(count(first, "triangles") > 0);
      assert.ok(count(first, "emitters") > 0);
      assert.equal(count(first, "instances"), 0);
    }
  });
}

test("stats realizes native voxel geometry like the render scene path", () => {
  // Same TRTPROC encoding as tools/voxel-level/generate.ts, but no external benchmark assets.
  const assets = mkdtempSync(join(tmpdir(), "threert-voxel-parity-"));
  try {
    const dir = join(assets, "stats-voxel");
    mkdirSync(dir, { recursive: true });
    const grid = new VoxelGrid(0.1);
    grid.set(0, 0, 0, 1);
    const { boxes, data } = grid.layout("object");
    writeFileSync(join(dir, "single.tpg"), encodeProcAsset(boxes, data));

    const first = readStats("stats-voxel", assets);
    const again = readStats("stats-voxel", assets);
    for (const field of fields) {
      assert.equal(count(first, field), count(again, field), `voxel: non-deterministic ${field}`);
    }
    // One isolated occupied cell exposes six quads, each divided into two triangles.
    // Before voxel realization stats sees none of these triangles; Hosts::scene realizes them.
    assert.equal(count(first, "triangles"), 12);
    assert.equal(count(first, "triangles"), count(first, "flat_triangles") + count(first, "instanced_triangles"));
    assert.ok(count(first, "objects") >= 1);
    assert.ok(count(first, "geometries") >= 1);
    assert.ok(count(first, "materials") >= 2);
    assert.equal(count(first, "emitters"), 0);
  } finally {
    rmSync(assets, { recursive: true, force: true });
  }
});
