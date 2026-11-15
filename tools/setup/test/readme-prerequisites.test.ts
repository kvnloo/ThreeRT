// Keep Linux onboarding instructions aligned with the CPU-only setup path.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
const build = readme.match(/### Build the engine from source[\s\S]*?(?=\n## Demos in this repository)/)?.[0] ?? "";

test("Linux onboarding lists optional asset tools and their actual skip behavior", () => {
  assert.ok(build, "the README must keep the source-build section");
  for (const item of [
    "#### Linux prerequisites and optional demo assets",
    "python3-venv",
    "BLENDER=/absolute/path/to/blender",
    "CHROME=/absolute/path/to/chrome",
    "skips them and exits successfully",
    "skips it when Chrome is absent",
    "Khronos fetch and voxel generation",
    "exits nonzero after attempting the independent fetchers",
    "masks/T_Cloud.png",
    "node tools/fetch-khronos.ts",
    "manifest.json",
  ]) {
    assert.ok(build.includes(item), `missing Linux setup guidance: ${item}`);
  }
});

test("README gives CPU commands without presenting them as asset or GPU validation", () => {
  const cpu = build.split("#### CPU-only checks (no GPU)")[1]?.split("```bash")[1]?.split("```")[0] ?? "";
  assert.ok(cpu, "the README must contain a CPU-only command block");
  for (const command of [
    "npm ci",
    "bun scripts/setup.ts --no-fetch",
    "npm run typecheck",
    "npm test",
    "node tools/three-compat.ts --no-render",
  ]) {
    assert.ok(cpu.includes(command), `missing CPU-only command: ${command}`);
  }
  assert.doesNotMatch(cpu, /cargo test|test:render|threert-render/);
  assert.match(build, /do \*\*not\*\* prove demo assets are complete/);
});
