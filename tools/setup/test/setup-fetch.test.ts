// CPU-only regression: one failing asset generator must not strand independent fetches or mask setup failure.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fetchSetupAssets, type SetupFetchCommands } from "../../../scripts/setup-fetch.ts";

function recordedCommands(events: string[], failures: Readonly<Record<string, Error>> = {}): SetupFetchCommands {
  const execute = async (name: string) => {
    events.push(name);
    if (failures[name]) throw failures[name];
  };
  return {
    helmet: () => execute("helmet"),
    polyhaven: () => execute("polyhaven"),
    kabukichoPolyhaven: () => execute("kabukicho-polyhaven"),
    signs: () => execute("signs"),
    khronos: () => execute("khronos"),
    quaternius: () => execute("quaternius"),
    orca: () => execute("orca"),
    voxel: () => execute("voxel"),
  };
}

test("failed signage still runs Khronos and voxel generation, then rejects the overall setup", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "threert-fetch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Reproduce the empty directory left by gen_signs.py before its first font lookup.
  mkdirSync(join(root, "kabukicho/textures"), { recursive: true });
  const events: string[] = [];
  const fontFailure = new Error("cannot open Hiragino font");
  await assert.rejects(
    fetchSetupAssets(root, false, recordedCommands(events, { signs: fontFailure })),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors.length, 1);
      assert.match(error.message, /Kabukichō signs/);
      assert.equal((error.errors[0] as Error).cause, fontFailure);
      return true;
    },
  );
  assert.deepEqual(events, ["helmet", "polyhaven", "kabukicho-polyhaven", "signs", "khronos", "orca", "voxel"]);
});

test("a partial sign directory or missing final mask triggers retry; completed sentinels skip it", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "threert-fetch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const textureDir = join(root, "kabukicho/textures");
  const masksDir = join(root, "kabukicho/masks");
  mkdirSync(textureDir, { recursive: true });
  const events: string[] = [];
  const commands = recordedCommands(events);

  await fetchSetupAssets(root, false, commands);
  assert.ok(events.includes("signs"), "an empty textures directory is not a completed generation");
  writeFileSync(join(textureDir, "manifest.json"), "[]");
  events.length = 0;
  await fetchSetupAssets(root, false, commands);
  assert.ok(events.includes("signs"), "the final mask is required too");
  mkdirSync(masksDir, { recursive: true });
  writeFileSync(join(masksDir, "T_Cloud.png"), "");
  events.length = 0;
  await fetchSetupAssets(root, false, commands);
  assert.ok(!events.includes("signs"), "completed generation is not rerun");
});

test("multiple failed fetchers are all reported after later independent steps run", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "threert-fetch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const events: string[] = [];
  const helmetFailure = new Error("curl failed");
  const khronosFailure = new Error("HTTP 503");
  await assert.rejects(
    fetchSetupAssets(root, true, recordedCommands(events, { helmet: helmetFailure, khronos: khronosFailure })),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors.map((e: Error) => e.message), ["DamagedHelmet failed", "Khronos sample assets failed"]);
      assert.equal((error.errors[0] as Error).cause, helmetFailure);
      assert.equal((error.errors[1] as Error).cause, khronosFailure);
      assert.match(error.message, /DamagedHelmet.*Khronos sample assets/);
      return true;
    },
  );
  assert.deepEqual(events, ["helmet", "polyhaven", "kabukicho-polyhaven", "signs", "khronos", "quaternius", "orca", "voxel"]);
});
