import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SCRIPT_PATH), "..");

const SITE_FILES = ["app.js", "index.html", "styles.css"] as const;
const ARTIFACT_FILES = [
  "data/datadecide-ledger.v1.json",
  "data/dpi-provenance-contract.v1.json",
  "data/flow-lenses.v1.json",
] as const;
const OUTPUT_FILES = ["app.js", "data/summary.json", "index.html", "styles.css"] as const;
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_SUMMARY_BYTES = 64 * 1024;

type JsonRecord = Record<string, unknown>;

export interface BuildSiteOptions {
  rootDir?: string;
  outDir?: string;
}

export interface BuildSiteResult {
  outDir: string;
  files: readonly string[];
}

function displayPath(path: string): string {
  return path.split(sep).join("/");
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function pathStat(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

async function assertNoSymbolicLinkInPath(path: string, label: string): Promise<void> {
  let current = resolve(path);
  while (true) {
    const stat = await pathStat(current);
    if (stat?.isSymbolicLink()) {
      throw new Error(`${label} contains a symbolic-link path component: ${displayPath(current)}`);
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

async function removeDirectoryIfPathSafe(path: string, label: string): Promise<void> {
  await assertNoSymbolicLinkInPath(path, label);
  await rm(path, { recursive: true, force: true });
}

function assertSafeOutputPath(path: string, rootDir: string, siteDir: string): void {
  const root = parse(path).root;
  if (path === root || path === rootDir || path === siteDir) {
    throw new Error(`refusing unsafe site output path: ${displayPath(path)}`);
  }

  const fromSite = relative(siteDir, path);
  if (fromSite === "" || (!fromSite.startsWith(`..${sep}`) && fromSite !== ".." && !isAbsolute(fromSite))) {
    throw new Error("site output must not be nested inside source assets");
  }
}

async function collectRegularFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(current, entry.name);
    const relativePath = displayPath(relative(root, absolute));
    if (entry.isSymbolicLink()) {
      throw new Error(`symbolic links are not allowed in the site build: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...await collectRegularFiles(root, absolute));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`non-regular site build input is not allowed: ${relativePath}`);
    }
    files.push(relativePath);
  }

  return files;
}

function assertOnlyExpected(actual: readonly string[], expected: readonly string[], label: string): void {
  const expectedSet = new Set(expected);
  const unexpected = actual.filter((path) => !expectedSet.has(path));
  if (unexpected.length > 0) {
    throw new Error(`${label} contains unexpected files: ${unexpected.join(", ")}`);
  }
}

async function assertSourceAssets(siteDir: string): Promise<void> {
  await assertNoSymbolicLinkInPath(siteDir, "site source");
  const stat = await pathStat(siteDir);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("site source must be a real directory");
  }
  const files = await collectRegularFiles(siteDir);
  assertOnlyExpected(files, SITE_FILES, "site source");
  const missing = SITE_FILES.filter((path) => !files.includes(path));
  if (missing.length > 0) throw new Error(`site source is missing files: ${missing.join(", ")}`);
}

async function assertExistingOutputIsSafe(outDir: string): Promise<void> {
  await assertNoSymbolicLinkInPath(outDir, "site output");
  const stat = await pathStat(outDir);
  if (!stat) return;
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("site output must be a real directory when it already exists");
  }
  const files = await collectRegularFiles(outDir);
  assertOnlyExpected(files, OUTPUT_FILES, "site output");
}

async function readArtifact(rootDir: string, relativePath: string): Promise<JsonRecord> {
  const path = resolve(rootDir, relativePath);
  await assertNoSymbolicLinkInPath(path, `artifact ${relativePath}`);
  const stat = await pathStat(path);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`artifact must be a regular file: ${relativePath}`);
  }
  if (stat.size < 1 || stat.size > MAX_ARTIFACT_BYTES) {
    throw new Error(`artifact exceeded its byte boundary: ${relativePath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`could not parse ${relativePath}`, { cause: error });
  }
  return expectRecord(parsed, relativePath);
}

function expectRecord(value: unknown, name: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value as JsonRecord;
}

function field(record: JsonRecord, key: string, parent: string): unknown {
  if (!Object.hasOwn(record, key)) throw new TypeError(`${parent}.${key} is required`);
  return record[key];
}

function recordField(record: JsonRecord, key: string, parent: string): JsonRecord {
  return expectRecord(field(record, key, parent), `${parent}.${key}`);
}

function stringField(record: JsonRecord, key: string, parent: string): string {
  const value = field(record, key, parent);
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${parent}.${key} must be a non-empty string`);
  return value;
}

function numberField(record: JsonRecord, key: string, parent: string): number {
  const value = field(record, key, parent);
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${parent}.${key} must be finite`);
  return value;
}

function booleanField(record: JsonRecord, key: string, parent: string): boolean {
  const value = field(record, key, parent);
  if (typeof value !== "boolean") throw new TypeError(`${parent}.${key} must be boolean`);
  return value;
}

function arrayField(record: JsonRecord, key: string, parent: string): unknown[] {
  const value = field(record, key, parent);
  if (!Array.isArray(value)) throw new TypeError(`${parent}.${key} must be an array`);
  return value;
}

function stringArrayField(record: JsonRecord, key: string, parent: string): string[] {
  const values = arrayField(record, key, parent);
  if (!values.every((value) => typeof value === "string")) throw new TypeError(`${parent}.${key} must contain strings`);
  return values as string[];
}

function assertProtocol(record: JsonRecord, expected: string, name: string): void {
  const actual = stringField(record, "protocol", name);
  if (actual !== expected) throw new Error(`${name}.protocol drifted: ${actual}`);
}

function assertHttpsHubUrl(value: string, name: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "huggingface.co") {
    throw new TypeError(`${name} must be an HTTPS huggingface.co URL`);
  }
  return url.href;
}

function buildDataDecideSummary(source: JsonRecord) {
  const name = "datadecide";
  assertProtocol(source, "hf-kingdom-datadecide-ledger/v1", name);
  const study = recordField(source, "study", name);
  const boundary = recordField(source, "boundary", name);
  const sequence = recordField(study, "sequence_length_evidence", `${name}.study`);
  const paper = recordField(sequence, "paper", `${name}.study.sequence_length_evidence`);
  const code = recordField(sequence, "code", `${name}.study.sequence_length_evidence`);

  if (booleanField(boundary, "runtime_network", `${name}.boundary`)) throw new Error("DataDecide runtime network boundary must remain false");
  for (const excluded of ["token_shards_included", "checkpoint_weights_included", "evaluation_instance_bodies_included"] as const) {
    if (booleanField(boundary, excluded, `${name}.boundary`)) throw new Error(`DataDecide ${excluded} must remain false`);
  }

  return {
    protocol: stringField(source, "protocol", name),
    observedAt: stringField(source, "observed_at", name),
    purpose: stringField(source, "purpose", name),
    recipeCount: numberField(study, "recipe_count", `${name}.study`),
    scaleCount: numberField(study, "scale_count", `${name}.study`),
    seedsPerRecipeScale: numberField(study, "scientific_seeds_per_recipe_scale", `${name}.study`),
    scientificRunCount: numberField(study, "scientific_model_run_count", `${name}.study`),
    operationalRunCount: numberField(study, "operational_run_manifest_count", `${name}.study`),
    checkpointRevisionCount: numberField(study, "usable_checkpoint_revision_count", `${name}.study`),
    sequenceDrift: {
      paper: numberField(paper, "table_value", `${name}.study.sequence_length_evidence.paper`),
      code: numberField(code, "constant_value", `${name}.study.sequence_length_evidence.code`),
      status: stringField(recordField(sequence, "resolution", `${name}.study.sequence_length_evidence`), "status", `${name}.study.sequence_length_evidence.resolution`),
    },
    boundaries: {
      runtimeNetwork: false,
      tokenShardsIncluded: false,
      checkpointWeightsIncluded: false,
      evaluationInstanceBodiesIncluded: false,
    },
  };
}

function buildDpiSummary(source: JsonRecord) {
  const name = "dpi";
  assertProtocol(source, "hf-kingdom-dpi-provenance-contract/v1", name);
  const identity = recordField(source, "identity", name);
  const original = recordField(source, "original_exports", name);
  const parquet = recordField(source, "parquet_exports", name);
  const viewer = recordField(source, "viewer", name);
  const reconciliation = recordField(source, "count_reconciliation", name);
  const access = recordField(source, "access", name);
  const columns = recordField(source, "column_boundary", name);
  const reader = recordField(source, "reader", name);
  const evidence = recordField(source, "evidence_boundary", name);

  if (booleanField(reader, "reader_implemented", `${name}.reader`)) throw new Error("DPI reader must remain unimplemented for this surface");
  if (booleanField(access, "dataset_rows_read", `${name}.access`)) throw new Error("DPI dataset rows must remain unread");
  if (booleanField(evidence, "contract_contains_raw_dataset_text", `${name}.evidence_boundary`)) throw new Error("DPI contract must not contain raw text");
  if (booleanField(columns, "row_level_output_permitted", `${name}.column_boundary`)) throw new Error("DPI row output must remain forbidden");

  return {
    protocol: stringField(source, "protocol", name),
    observedAt: stringField(source, "observed_at", name),
    purpose: stringField(source, "purpose", name),
    datasetId: stringField(identity, "dataset_id", `${name}.identity`),
    canonicalUrl: assertHttpsHubUrl(stringField(identity, "canonical_url", `${name}.identity`), `${name}.identity.canonical_url`),
    mainRevision: stringField(identity, "main_revision", `${name}.identity`),
    originalFileCount: arrayField(original, "files", `${name}.original_exports`).length,
    parquetFileCount: arrayField(parquet, "files", `${name}.parquet_exports`).length,
    viewerRows: numberField(viewer, "rows", `${name}.viewer`),
    cardRows: numberField(reconciliation, "dataset_card_documents", `${name}.count_reconciliation`),
    unresolvedDelta: numberField(reconciliation, "card_minus_viewer", `${name}.count_reconciliation`),
    countResolved: booleanField(reconciliation, "resolved", `${name}.count_reconciliation`),
    readerStatus: "intentionally deferred",
    readerReason: stringField(reader, "reason", `${name}.reader`),
    projectedColumns: stringArrayField(columns, "projected_logical_columns", `${name}.column_boundary`),
    excludedContentColumns: stringArrayField(columns, "excluded_content_columns", `${name}.column_boundary`),
    boundaries: {
      accessMode: stringField(access, "mode", `${name}.access`),
      datasetRowsRead: false,
      rawDatasetTextIncluded: false,
      rowLevelOutputPermitted: false,
      maximumMetadataRequests: numberField(access, "max_metadata_requests", `${name}.access`),
      maximumTotalResponseBytes: numberField(access, "max_total_response_body_bytes", `${name}.access`),
    },
  };
}

function buildFlowSummary(source: JsonRecord) {
  const name = "flow";
  assertProtocol(source, "hf-kingdom-flow-lenses/v1", name);
  const definition = recordField(source, "definition", name);
  const boundary = recordField(source, "boundary", name);
  const dimensions = stringArrayField(source, "dimensions", name);
  const rawEntries = arrayField(source, "entries", name);

  for (const excluded of ["remote_rows_collected", "remote_files_collected", "hub_mutation"] as const) {
    if (booleanField(boundary, excluded, `${name}.boundary`)) throw new Error(`Flow ${excluded} must remain false`);
  }
  for (const required of ["no_universal_vibe_score", "disagreement_is_data"] as const) {
    if (!booleanField(boundary, required, `${name}.boundary`)) throw new Error(`Flow ${required} must remain true`);
  }

  const entries = rawEntries.map((rawEntry, index) => {
    const entryName = `${name}.entries[${index}]`;
    const entry = expectRecord(rawEntry, entryName);
    const evidence = recordField(entry, "evidence", entryName);
    const flow = recordField(entry, "flow", entryName);
    const viewer = recordField(entry, "viewer", entryName);
    const route = recordField(entry, "route", entryName);
    const license = recordField(entry, "license", entryName);
    const nuances = stringArrayField(entry, "nuances", entryName);
    if (nuances.length === 0) throw new TypeError(`${entryName}.nuances must not be empty`);

    return {
      rank: numberField(entry, "rank", entryName),
      repoId: stringField(entry, "repo_id", entryName),
      canonicalUrl: assertHttpsHubUrl(stringField(entry, "canonical_url", entryName), `${entryName}.canonical_url`),
      domain: stringField(entry, "domain", entryName),
      axis: stringField(flow, "axis", `${entryName}.flow`),
      observerOrigin: stringField(evidence, "observer_origin", `${entryName}.evidence`),
      epistemicLayers: stringArrayField(evidence, "epistemic_layers", `${entryName}.evidence`),
      disagreement: stringField(evidence, "disagreement", `${entryName}.evidence`),
      viewerStatus: stringField(viewer, "status", `${entryName}.viewer`),
      routeMode: stringField(route, "mode", `${entryName}.route`),
      licenseStatus: stringField(license, "status", `${entryName}.license`),
      keyNuance: nuances[0]!,
    };
  });

  const domains = new Set(entries.map((entry) => entry.domain));
  const axes = new Set(entries.map((entry) => entry.axis));
  return {
    protocol: stringField(source, "protocol", name),
    observedAt: stringField(source, "observed_at", name),
    purpose: stringField(source, "purpose", name),
    definition: {
      flow: stringField(definition, "flow", `${name}.definition`),
      vibe: stringField(definition, "vibe", `${name}.definition`),
    },
    dimensions,
    dimensionCount: dimensions.length,
    entryCount: entries.length,
    domainCount: domains.size,
    axisCount: axes.size,
    entries,
    boundaries: {
      remoteRowsCollected: false,
      remoteFilesCollected: false,
      hubMutation: false,
      noUniversalVibeScore: true,
      disagreementIsData: true,
    },
  };
}

async function buildSummary(rootDir: string) {
  const [datadecide, dpi, flow] = await Promise.all(ARTIFACT_FILES.map((path) => readArtifact(rootDir, path)));
  return {
    schema: "hf-kingdom-site-summary/v1",
    generatedFrom: [...ARTIFACT_FILES],
    datadecide: buildDataDecideSummary(datadecide!),
    dpi: buildDpiSummary(dpi!),
    flow: buildFlowSummary(flow!),
  };
}

async function createOutput(tempDir: string, siteDir: string, summary: unknown): Promise<void> {
  await mkdir(join(tempDir, "data"), { recursive: true });
  for (const file of SITE_FILES) await copyFile(join(siteDir, file), join(tempDir, file));
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > MAX_SUMMARY_BYTES) {
    throw new Error("site summary exceeded its byte boundary");
  }
  await writeFile(join(tempDir, "data/summary.json"), serialized, { encoding: "utf8", mode: 0o644 });
}

export async function buildSite(options: BuildSiteOptions = {}): Promise<BuildSiteResult> {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT);
  const siteDir = resolve(rootDir, "site");
  const outDir = resolve(options.outDir ?? join(rootDir, "site-dist"));
  const tempDir = `${outDir}.building`;
  assertSafeOutputPath(outDir, rootDir, siteDir);
  assertSafeOutputPath(tempDir, rootDir, siteDir);

  await assertNoSymbolicLinkInPath(rootDir, "project root");
  await assertSourceAssets(siteDir);
  await assertExistingOutputIsSafe(outDir);
  await assertExistingOutputIsSafe(tempDir);
  const summary = await buildSummary(rootDir);

  await removeDirectoryIfPathSafe(tempDir, "temporary site output");
  try {
    await createOutput(tempDir, siteDir, summary);
    await assertNoSymbolicLinkInPath(tempDir, "temporary site output");
    const builtFiles = await collectRegularFiles(tempDir);
    assertOnlyExpected(builtFiles, OUTPUT_FILES, "new site output");
    const missing = OUTPUT_FILES.filter((path) => !builtFiles.includes(path));
    if (missing.length > 0) throw new Error(`new site output is missing files: ${missing.join(", ")}`);
    await removeDirectoryIfPathSafe(outDir, "site output");
    await assertNoSymbolicLinkInPath(dirname(outDir), "site output parent");
    await rename(tempDir, outDir);
  } catch (error) {
    try {
      await removeDirectoryIfPathSafe(tempDir, "temporary site output cleanup");
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "site build failed and temporary output could not be removed safely");
    }
    throw error;
  }

  return { outDir, files: [...OUTPUT_FILES] };
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  const result = await buildSite();
  console.log(`Built ${result.files.length} static files in ${displayPath(relative(DEFAULT_ROOT, result.outDir))}/`);
}
