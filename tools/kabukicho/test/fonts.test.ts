// The real Python font lookup, exercised without Pillow or machine-installed fonts.
// A clean Linux setup must not depend on /System/Library/Fonts.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const resolver = fileURLToPath(new URL("../font_paths.py", import.meta.url));
const generator = fileURLToPath(new URL("../gen_signs.py", import.meta.url));
const python = process.env.PYTHON ?? "python3";

const resolveCode = [
  "import json, runpy, sys",
  "print(json.dumps(runpy.run_path(sys.argv[1])['resolve_fonts']()))",
].join("\n");

const generatorCode = [
  "import json, runpy, sys, types",
  // gen_signs.py creates no images until its __main__ block. Stub only its import.
  "sys.modules['PIL'] = types.SimpleNamespace(Image=None, ImageDraw=None, ImageFilter=None, ImageFont=None, ImageChops=None)",
  "script, output = sys.argv[1:]",
  "sys.argv = [script, output]",
  "scope = runpy.run_path(script, run_name='__font_probe__')",
  "print(json.dumps([scope['GOTHIC'][8], scope['MINCHO'], scope['MARU']]))",
].join("\n");

function probe(code: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(python, ["-I", "-c", code, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function fakeFcMatch(directory: string, sans: string, serif: string, languages = "ja|en") {
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const cmd = join(bin, "fc-match");
  // The mock uses the same pattern argument the production lookup sends.
  writeFileSync(cmd, [
    "#!/bin/sh",
    'case "$3" in',
    `  serif:*) printf '%s\\n' '${serif}' '${languages}' ;;`,
    `  *) printf '%s\\n' '${sans}' '${languages}' ;;`,
    "esac",
    "",
  ].join("\n"));
  chmodSync(cmd, 0o755);
  return `${bin}:${process.env.PATH ?? ""}`;
}

test("the Hiragino directory override keeps the original per-weight font paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "threert-fonts-"));
  try {
    for (let w = 0; w <= 9; w++) writeFileSync(join(dir, `ヒラギノ角ゴシック W${w}.ttc`), "");
    writeFileSync(join(dir, "ヒラギノ明朝 ProN.ttc"), "");
    writeFileSync(join(dir, "ヒラギノ丸ゴ ProN W4.ttc"), "");

    const env = { THREERT_FONT_DIR: dir };
    const result = probe(resolveCode, [resolver], env);
    assert.equal(result.status, 0, result.stderr);
    const [gothic, mincho, maru] = JSON.parse(result.stdout);
    for (let w = 0; w <= 9; w++) assert.equal(gothic[w], join(dir, `ヒラギノ角ゴシック W${w}.ttc`));
    assert.equal(mincho, join(dir, "ヒラギノ明朝 ProN.ttc"));
    assert.equal(maru, join(dir, "ヒラギノ丸ゴ ProN W4.ttc"));

    // Call the actual generator's top-level setup, not just the helper.
    const rendered = probe(generatorCode, [generator, join(dir, "output")], env);
    assert.equal(rendered.status, 0, rendered.stderr);
    assert.deepEqual(JSON.parse(rendered.stdout), [
      join(dir, "ヒラギノ角ゴシック W8.ttc"),
      join(dir, "ヒラギノ明朝 ProN.ttc"),
      join(dir, "ヒラギノ丸ゴ ProN W4.ttc"),
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Linux resolves Japanese sans and serif fonts through fontconfig", () => {
  const dir = mkdtempSync(join(tmpdir(), "threert-fonts-"));
  try {
    const sans = join(dir, "NotoSansCJK.ttc");
    const serif = join(dir, "NotoSerifCJK.ttc");
    writeFileSync(sans, "");
    writeFileSync(serif, "");
    const env = {
      THREERT_FONT_DIR: join(dir, "missing"),
      PATH: fakeFcMatch(dir, sans, serif),
    };
    const result = probe(resolveCode, [resolver], env);
    assert.equal(result.status, 0, result.stderr);
    const [gothic, mincho, maru] = JSON.parse(result.stdout);
    for (let w = 0; w <= 9; w++) assert.equal(gothic[w], sans);
    assert.equal(mincho, serif);
    assert.equal(maru, sans);

    const rendered = probe(generatorCode, [generator, join(dir, "output")], env);
    assert.equal(rendered.status, 0, rendered.stderr);
    assert.deepEqual(JSON.parse(rendered.stdout), [sans, serif, sans]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an installed non-Japanese fallback fails with actionable guidance", () => {
  const dir = mkdtempSync(join(tmpdir(), "threert-fonts-"));
  try {
    const latin = join(dir, "Latin.ttf");
    writeFileSync(latin, "");
    const result = probe(resolveCode, [resolver], {
      THREERT_FONT_DIR: join(dir, "missing"),
      PATH: fakeFcMatch(dir, latin, latin, "en|fr"),
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no Japanese font found/);
    assert.match(result.stderr, /fonts-noto-cjk/);
    assert.match(result.stderr, /THREERT_FONT_DIR/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
