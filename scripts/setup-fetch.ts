// Each independent asset fetcher gets a chance to run. Setup still fails when any required step fails.
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface SetupFetchCommands {
  helmet: () => Promise<unknown>;
  polyhaven: () => Promise<unknown>;
  kabukichoPolyhaven: () => Promise<unknown>;
  signs: () => Promise<unknown>;
  khronos: () => Promise<unknown>;
  quaternius: () => Promise<unknown>;
  orca: () => Promise<unknown>;
  voxel: () => Promise<unknown>;
}

export async function fetchSetupAssets(assetRoot: string, chromeAvailable: boolean, commands: SetupFetchCommands): Promise<void> {
  const asset = (name: string) => join(assetRoot, name);
  const steps: { name: string; run: () => Promise<unknown> }[] = [
    { name: "DamagedHelmet", run: async () => {
      if (!existsSync(asset("DamagedHelmet.glb"))) await commands.helmet();
    } },
    { name: "Poly Haven", run: commands.polyhaven },
    { name: "Kabukicho Poly Haven", run: commands.kabukichoPolyhaven },
    { name: "Kabukichō signs", run: async () => {
      // gen_signs.py writes the manifest last; gen_masks.py writes T_Cloud.png last.
      // An unsuccessful sign run can leave a textures directory behind.
      if (!existsSync(asset("kabukicho/textures/manifest.json")) || !existsSync(asset("kabukicho/masks/T_Cloud.png"))) {
        await commands.signs();
      }
    } },
    { name: "Khronos sample assets", run: commands.khronos },
    { name: "Quaternius", run: async () => {
      if (chromeAvailable || existsSync(asset("quaternius/ual/UAL1_Standard.glb"))) await commands.quaternius();
      else console.log("skipping Quaternius (needs Google Chrome, or CHROME=<binary>): the mannequin scenes and animation/skinned-pose test need it");
    } },
    { name: "ORCA assets", run: commands.orca },
    { name: "Voxel level", run: commands.voxel },
  ];

  const failures: { name: string; cause: unknown }[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (cause) {
      failures.push({ name: step.name, cause });
      console.error(`setup: ${step.name} failed; continuing with independent fetchers:`, cause);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map(({ name, cause }) => new Error(`${name} failed`, { cause })),
      `Asset setup incomplete: failed ${failures.map(({ name }) => name).join(", ")}; remaining fetchers were attempted.`,
    );
  }
}
