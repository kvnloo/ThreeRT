// gen_signs.py's font lookup (#73), run for real without Pillow or the machine's fonts:
// Hiragino files win when present, else fontconfig's Japanese face, else a clear exit.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const generator = fileURLToPath(new URL("../gen_signs.py", import.meta.url));

// gen_signs.py draws nothing until its __main__ block; stub only the Pillow import and read the chosen fonts.
const probe = [
  "import json, runpy, sys, types",
  "sys.modules['PIL'] = types.SimpleNamespace(Image=None, ImageDraw=None, ImageFilter=None, ImageFont=None, ImageChops=None)",
  "sys.argv = sys.argv[1:]",
  "s = runpy.run_path(sys.argv[0], run_name='__font_probe__')",
  "print(json.dumps([s['GOTHIC'][0], s['GOTHIC'][8], s['MINCHO'], s['MARU']]))",
].join("\n");

function run(dir: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.env.PYTHON ?? "python3", ["-I", "-c", probe, generator, join(dir, "out")], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

// An fc-match on PATH that answers like the real one for the pattern gen_signs.py sends.
function fakeFcMatch(dir: string, sans: string, serif: string, langs = "ja|en") {
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "fc-match"), [
    "#!/bin/sh",
    'case "$3" in',
    `  serif:*) printf '%s\\n%s' '${serif}' '${langs}' ;;`,
    `  *) printf '%s\\n%s' '${sans}' '${langs}' ;;`,
    "esac",
    "",
  ].join("\n"));
  chmodSync(join(bin, "fc-match"), 0o755);
  return `${bin}:${process.env.PATH ?? ""}`;
}

function withDir(fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "threert-fonts-"));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("Hiragino files in THREERT_FONT_DIR are used as before, per weight", () => withDir((dir) => {
  for (let w = 0; w <= 9; w++) writeFileSync(join(dir, `ヒラギノ角ゴシック W${w}.ttc`), "");
  writeFileSync(join(dir, "ヒラギノ明朝 ProN.ttc"), "");
  writeFileSync(join(dir, "ヒラギノ丸ゴ ProN W4.ttc"), "");
  const r = run(dir, { THREERT_FONT_DIR: dir, PATH: fakeFcMatch(dir, "/nope", "/nope") });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [
    join(dir, "ヒラギノ角ゴシック W0.ttc"),
    join(dir, "ヒラギノ角ゴシック W8.ttc"),
    join(dir, "ヒラギノ明朝 ProN.ttc"),
    join(dir, "ヒラギノ丸ゴ ProN W4.ttc"),
  ]);
}));

test("without Hiragino (stock Linux), fontconfig's Japanese sans and serif are used", () => withDir((dir) => {
  const r = run(dir, { THREERT_FONT_DIR: join(dir, "missing"), PATH: fakeFcMatch(dir, "/f/NotoSansCJK.ttc", "/f/NotoSerifCJK.ttc") });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ["/f/NotoSansCJK.ttc", "/f/NotoSansCJK.ttc", "/f/NotoSerifCJK.ttc", "/f/NotoSansCJK.ttc"]);
}));

test("no Japanese font at all: a clear exit, not a traceback", () => withDir((dir) => {
  const r = run(dir, { THREERT_FONT_DIR: join(dir, "missing"), PATH: fakeFcMatch(dir, "/f/DejaVuSans.ttf", "/f/DejaVuSerif.ttf", "en|fr") });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /fonts-noto-cjk/);
  assert.match(r.stderr, /THREERT_FONT_DIR/);
  assert.doesNotMatch(r.stderr, /Traceback/);
}));
