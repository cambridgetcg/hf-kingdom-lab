import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSite } from "../scripts/build-site.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_SUMMARY_BYTES = 64 * 1024;
const temporaryDirectories: string[] = [];

async function temporaryDirectory(label: string): Promise<string> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), `hfkl-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

async function outputSnapshot(root: string, current = root): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) Object.assign(snapshot, await outputSnapshot(root, path));
    else snapshot[relative(root, path)] = createHash("sha256").update(await readFile(path)).digest("hex");
  }
  return snapshot;
}

async function readBuiltSummary(outDir: string) {
  return JSON.parse(await readFile(join(outDir, "data/summary.json"), "utf8")) as Record<string, any>;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("static Pages build", () => {
  test("builds deterministic project-path-safe output", async () => {
    const workspace = await temporaryDirectory("site-determinism");
    const first = join(workspace, "first");
    const second = join(workspace, "second");

    await buildSite({ rootDir: ROOT, outDir: first });
    const firstSnapshot = await outputSnapshot(first);
    await buildSite({ rootDir: ROOT, outDir: first });
    expect(await outputSnapshot(first)).toEqual(firstSnapshot);

    await buildSite({ rootDir: ROOT, outDir: second });
    expect(await outputSnapshot(second)).toEqual(firstSnapshot);
    expect(Object.keys(firstSnapshot).sort()).toEqual([
      "app.js",
      "data/summary.json",
      "index.html",
      "styles.css",
    ]);

    const html = await readFile(join(first, "index.html"), "utf8");
    expect(html).toContain('href="./styles.css"');
    expect(html).toContain('src="./app.js"');
    expect(html).not.toMatch(/(?:href|src)=["']\/(?!\/)/);
    expect(html).toContain('class="artifact-card loading-card" hidden');
    expect(html).toContain('id="artifact-summary" class="artifact-grid" aria-live="polite" aria-busy="false"');
    expect(html).toContain('id="flow-controls" role="group" aria-label="Filter atlas by domain"');
    expect(html).toContain("No application analytics or remote scripts.");
  });

  test("renders all three artifacts as bounded summaries", async () => {
    const workspace = await temporaryDirectory("site-artifacts");
    await buildSite({ rootDir: ROOT, outDir: workspace });
    const summary = await readBuiltSummary(workspace);

    expect(summary.schema).toBe("hf-kingdom-site-summary/v1");
    expect(summary.generatedFrom).toEqual([
      "data/datadecide-ledger.v1.json",
      "data/dpi-provenance-contract.v1.json",
      "data/flow-lenses.v1.json",
    ]);
    expect(summary.datadecide.protocol).toBe("hf-kingdom-datadecide-ledger/v1");
    expect(summary.dpi.protocol).toBe("hf-kingdom-dpi-provenance-contract/v1");
    expect(summary.flow.protocol).toBe("hf-kingdom-flow-lenses/v1");
    expect(summary.datadecide.recipeCount).toBe(25);
    expect(summary.dpi.unresolvedDelta).toBe(128);
    expect(summary.flow.entries).toHaveLength(10);
  });

  test("keeps dataset bodies, reader execution, and universal scoring outside the surface", async () => {
    const workspace = await temporaryDirectory("site-boundaries");
    await buildSite({ rootDir: ROOT, outDir: workspace });
    const summary = await readBuiltSummary(workspace);

    expect(summary.datadecide.boundaries).toEqual({
      runtimeNetwork: false,
      tokenShardsIncluded: false,
      checkpointWeightsIncluded: false,
      evaluationInstanceBodiesIncluded: false,
    });
    expect(summary.dpi.readerStatus).toBe("intentionally deferred");
    expect(summary.dpi.boundaries.datasetRowsRead).toBe(false);
    expect(summary.dpi.boundaries.rawDatasetTextIncluded).toBe(false);
    expect(summary.dpi.boundaries.rowLevelOutputPermitted).toBe(false);
    expect(summary.flow.boundaries.remoteRowsCollected).toBe(false);
    expect(summary.flow.boundaries.remoteFilesCollected).toBe(false);
    expect(summary.flow.boundaries.hubMutation).toBe(false);
    expect(summary.flow.boundaries.noUniversalVibeScore).toBe(true);

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('"tables"');
    expect(serialized).not.toContain('"original_exports"');
    expect(serialized).not.toContain('"parquet_exports"');
    expect(Buffer.byteLength(serialized)).toBeLessThan(40_000);
  });

  test("has no remote scripts, stylesheets, fonts, or runtime data fallbacks", async () => {
    const workspace = await temporaryDirectory("site-dependencies");
    await buildSite({ rootDir: ROOT, outDir: workspace });
    const html = await readFile(join(workspace, "index.html"), "utf8");
    const css = await readFile(join(workspace, "styles.css"), "utf8");
    const app = await readFile(join(workspace, "app.js"), "utf8");

    expect(html).not.toMatch(/<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//i);
    expect(css).not.toMatch(/@import\b|url\(\s*["']?https?:\/\//i);
    expect(app).not.toMatch(/https?:\/\//i);
    expect(app).toContain('const SUMMARY_URL = "./data/summary.json"');
    expect(app).not.toContain("localStorage");
    expect(app).not.toContain("document.cookie");
  });

  test("rejects unexpected existing output instead of deleting it", async () => {
    const workspace = await temporaryDirectory("site-output-guard");
    const outDir = join(workspace, "site-dist");
    await buildSite({ rootDir: ROOT, outDir });
    await writeFile(join(outDir, "keep-me.txt"), "unrelated\n");

    await expect(buildSite({ rootDir: ROOT, outDir })).rejects.toThrow("site output contains unexpected files: keep-me.txt");
    expect(await readFile(join(outDir, "keep-me.txt"), "utf8")).toBe("unrelated\n");
  });

  test("rejects symbolic-link source assets", async () => {
    const workspace = await temporaryDirectory("site-symlink-guard");
    const fixtureRoot = join(workspace, "fixture");
    await cp(join(ROOT, "site"), join(fixtureRoot, "site"), { recursive: true });
    await cp(join(ROOT, "data"), join(fixtureRoot, "data"), { recursive: true });
    await unlink(join(fixtureRoot, "site/app.js"));
    await symlink(join(ROOT, "site/app.js"), join(fixtureRoot, "site/app.js"));

    await expect(buildSite({ rootDir: fixtureRoot })).rejects.toThrow("symbolic links are not allowed");
  });

  test("rejects a symbolic-link artifact-directory ancestor", async () => {
    const workspace = await temporaryDirectory("site-artifact-ancestor-guard");
    const fixtureRoot = join(workspace, "fixture");
    await cp(join(ROOT, "site"), join(fixtureRoot, "site"), { recursive: true });
    await symlink(join(ROOT, "data"), join(fixtureRoot, "data"));

    await expect(buildSite({ rootDir: fixtureRoot })).rejects.toThrow("contains a symbolic-link path component");
  });

  test("rejects a symbolic-link output-parent ancestor before writing", async () => {
    const workspace = await temporaryDirectory("site-output-ancestor-guard");
    const target = join(workspace, "target");
    const alias = join(workspace, "alias");
    await mkdir(target);
    await symlink(target, alias);

    await expect(buildSite({ rootDir: ROOT, outDir: join(alias, "site-dist") })).rejects.toThrow("site output contains a symbolic-link path component");
    expect(await readdir(target)).toEqual([]);
  });

  test("rejects an artifact over the input byte cap", async () => {
    const workspace = await temporaryDirectory("site-artifact-cap");
    const fixtureRoot = join(workspace, "fixture");
    await cp(join(ROOT, "site"), join(fixtureRoot, "site"), { recursive: true });
    await cp(join(ROOT, "data"), join(fixtureRoot, "data"), { recursive: true });
    await writeFile(join(fixtureRoot, "data/datadecide-ledger.v1.json"), "x".repeat(MAX_ARTIFACT_BYTES + 1));

    await expect(buildSite({ rootDir: fixtureRoot })).rejects.toThrow("artifact exceeded its byte boundary: data/datadecide-ledger.v1.json");
  });

  test("rejects a projected summary over the output byte cap", async () => {
    const workspace = await temporaryDirectory("site-summary-cap");
    const fixtureRoot = join(workspace, "fixture");
    await cp(join(ROOT, "site"), join(fixtureRoot, "site"), { recursive: true });
    await cp(join(ROOT, "data"), join(fixtureRoot, "data"), { recursive: true });
    const ledgerPath = join(fixtureRoot, "data/datadecide-ledger.v1.json");
    const ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as Record<string, unknown>;
    ledger.purpose = "bounded-summary-cap-witness-".repeat(Math.ceil(MAX_SUMMARY_BYTES / 10));
    await writeFile(ledgerPath, `${JSON.stringify(ledger)}\n`);

    await expect(buildSite({ rootDir: fixtureRoot })).rejects.toThrow("site summary exceeded its byte boundary");
  });
});
