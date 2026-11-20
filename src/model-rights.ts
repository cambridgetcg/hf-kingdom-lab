import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertRepoId } from "./hub.ts";

// The model rights register is checked-in evidence for the source checkout.
// It is deliberately left out of the npm artifact (see package.json "files"
// and scripts/verify-package.ts) and is not exported from index.ts.

export const MODEL_RIGHTS_PROTOCOL = "hf-kingdom-model-rights/v1";

// The repositories a row may cite as a source. Each must be public. Adding one
// is a reviewed code change, made only after confirming that an anonymous
// reader can open the cited files at the cited commits.
export const SOURCE_REPOSITORIES = [
  "cambridgetcg/hf-kingdom-lab",
  "cambridgetcg/agenttool",
  "cambridgetcg/KINGDOM-OS",
] as const;

export const WEIGHT_FORMATS = ["safetensors", "gguf", "onnx"] as const;
export const AUXILIARY_FORMATS = ["json"] as const;
export const FILE_FORMATS = [...WEIGHT_FORMATS, ...AUXILIARY_FORMATS] as const;
export const NEVER_FORMATS = ["pickle"] as const;

export const RIGHTS_CLASSES = ["P", "T", "N"] as const;
export const ROW_CLASSES = ["unreviewed", ...RIGHTS_CLASSES] as const;
export const RESEED_STATES = ["not-cleared"] as const;
export const MODEL_ORIGINS = ["third-party", "estate"] as const;
export const EXTERNAL_DATA_CHECKS = [
  "not-applicable",
  "pending",
  "no-external-data",
] as const;
export const LICENSE_NOT_RECORDED = "not recorded";

export const CLASS_KEY = {
  P: "perpetual and unrestricted",
  T: "conditional or terminable",
  N: "none, gated or unreviewed",
  unreviewed:
    "no named person has yet read the licence text at the pinned commit; treated as N",
} as const;

export type WeightFormat = (typeof WEIGHT_FORMATS)[number];
export type FileFormat = (typeof FILE_FORMATS)[number];
export type RightsClass = (typeof RIGHTS_CLASSES)[number];
export type RowClass = (typeof ROW_CLASSES)[number];
export type ReseedState = (typeof RESEED_STATES)[number];
export type ModelOrigin = (typeof MODEL_ORIGINS)[number];
export type ExternalDataCheck = (typeof EXTERNAL_DATA_CHECKS)[number];

export interface EstateSourceRef {
  repository: string;
  path: string;
  commit: string;
  locator: string;
}

export interface ExternalDataEvidence {
  checked_on: string;
  source: EstateSourceRef;
}

export interface ModelRightsFile {
  path: string;
  size: number;
  sha256: string;
  format: FileFormat;
  external_data_check: ExternalDataCheck;
  external_data_evidence: ExternalDataEvidence | null;
  upstream_url: string;
  source: EstateSourceRef;
}

export interface ModelRightsLicense {
  tag_at_pin: string;
  observed_on: string | null;
  source: EstateSourceRef | null;
}

export interface ModelRightsHubFlags {
  gated: false | "auto" | "manual" | null;
  private: boolean | null;
  disabled: boolean | null;
  observed_on: string | null;
  source: EstateSourceRef | null;
}

export interface ModelRightsDrift {
  observed_on: string;
  observation: string;
  source: EstateSourceRef;
}

export interface ModelRightsEntry {
  repo_id: string;
  revision: string;
  origin: ModelOrigin;
  upstream_url: string;
  pin_sources: EstateSourceRef[];
  files: ModelRightsFile[] | "pending";
  license: ModelRightsLicense;
  class: RowClass;
  reviewer: string | null;
  reviewed_on: string | null;
  duties: string[];
  hub_flags: ModelRightsHubFlags;
  drift: ModelRightsDrift[];
  reseed: ReseedState;
  notes: string[];
}

export interface ModelRightsRegister {
  protocol: typeof MODEL_RIGHTS_PROTOCOL;
  compiled_on: string;
  purpose: string;
  basis: string;
  boundary: {
    register_is_evidence_not_authority: true;
    classes_are_working_reading_not_legal_advice: true;
    license_tags_are_publisher_assertions: true;
    points_at_upstream_commit_pinned_urls: true;
    weights_published_or_seeded_by_this_register: false;
    reseed_cleared_for_any_row: false;
    network_requests_made_to_build: false;
    model_files_read_or_hashed_to_build: false;
  };
  notice: string[];
  formats: {
    weights: WeightFormat[];
    auxiliary: (typeof AUXILIARY_FORMATS)[number][];
    never: (typeof NEVER_FORMATS)[number][];
    onnx_rule: string;
    pickle_rule: string;
  };
  classes: typeof CLASS_KEY;
  open_decisions: string[];
  entries: ModelRightsEntry[];
}

const DEFAULT_REGISTER_PATH = resolve(
  import.meta.dir,
  "..",
  "data",
  "model-rights.v1.json",
);
const HUB_ORIGIN = "https://huggingface.co";
const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LICENSE_TAG = /^[a-z0-9][a-z0-9.+-]*$/;
const SOURCE_REPOSITORY_SET: ReadonlySet<string> = new Set(SOURCE_REPOSITORIES);
const RELATIVE_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const FORMAT_EXTENSIONS: Record<FileFormat, string> = {
  safetensors: ".safetensors",
  gguf: ".gguf",
  onnx: ".onnx",
  json: ".json",
};
const PICKLE_FORMAT_NAMES = new Set([
  "pickle",
  "pkl",
  "pt",
  "pth",
  "bin",
  "ckpt",
  "pytorch",
  "torch",
]);
const PICKLE_EXTENSIONS = [".bin", ".pt", ".pth", ".ckpt", ".pkl", ".pickle"];
const BOUNDARY_TRUE = [
  "register_is_evidence_not_authority",
  "classes_are_working_reading_not_legal_advice",
  "license_tags_are_publisher_assertions",
  "points_at_upstream_commit_pinned_urls",
] as const;
const BOUNDARY_FALSE = [
  "weights_published_or_seeded_by_this_register",
  "reseed_cleared_for_any_row",
  "network_requests_made_to_build",
  "model_files_read_or_hashed_to_build",
] as const;

export async function loadModelRightsRegister(
  path = DEFAULT_REGISTER_PATH,
): Promise<ModelRightsRegister> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  assertModelRightsRegister(raw);
  return raw;
}

export function assertModelRightsRegister(
  value: unknown,
): asserts value is ModelRightsRegister {
  const register = objectValue(value, "register");
  exactKeys(register, [
    "protocol",
    "compiled_on",
    "purpose",
    "basis",
    "boundary",
    "notice",
    "formats",
    "classes",
    "open_decisions",
    "entries",
  ], "register");
  if (register.protocol !== MODEL_RIGHTS_PROTOCOL) {
    throw new TypeError(`register protocol must be ${MODEL_RIGHTS_PROTOCOL}`);
  }
  isoDate(register.compiled_on, "register.compiled_on");
  nonemptyString(register.purpose, "register.purpose");
  nonemptyString(register.basis, "register.basis");

  const boundary = objectValue(register.boundary, "register.boundary");
  exactKeys(boundary, [...BOUNDARY_TRUE, ...BOUNDARY_FALSE], "register.boundary");
  for (const key of BOUNDARY_TRUE) {
    if (boundary[key] !== true) throw new TypeError(`register.boundary.${key} must be true`);
  }
  for (const key of BOUNDARY_FALSE) {
    if (boundary[key] !== false) throw new TypeError(`register.boundary.${key} must be false`);
  }

  const notice = stringArray(register.notice, "register.notice");
  if (!notice.some((line) => line.includes("not legal advice"))) {
    throw new TypeError("register.notice must say that the classes are not legal advice");
  }

  const formats = objectValue(register.formats, "register.formats");
  exactKeys(formats, [
    "weights",
    "auxiliary",
    "never",
    "onnx_rule",
    "pickle_rule",
  ], "register.formats");
  exactStrings(formats.weights, WEIGHT_FORMATS, "register.formats.weights");
  exactStrings(formats.auxiliary, AUXILIARY_FORMATS, "register.formats.auxiliary");
  exactStrings(formats.never, NEVER_FORMATS, "register.formats.never");
  nonemptyString(formats.onnx_rule, "register.formats.onnx_rule");
  nonemptyString(formats.pickle_rule, "register.formats.pickle_rule");

  const classes = objectValue(register.classes, "register.classes");
  exactKeys(classes, Object.keys(CLASS_KEY), "register.classes");
  for (const [key, label] of Object.entries(CLASS_KEY)) {
    if (classes[key] !== label) {
      throw new TypeError(`register.classes.${key} must be "${label}"`);
    }
  }

  stringArray(register.open_decisions, "register.open_decisions", true);

  if (!Array.isArray(register.entries) || register.entries.length === 0) {
    throw new TypeError("register.entries must be a non-empty array");
  }
  assertDenseDataArray(register.entries, "register.entries");
  // Repository ids are compared without regard to letter case, so one model
  // cannot hold two rows that differ only in case.
  const repoIds = new Set<string>();
  for (const [index, rawEntry] of register.entries.entries()) {
    const repoId = assertEntry(rawEntry, `register.entries[${index}]`);
    const key = repoId.toLowerCase();
    if (repoIds.has(key)) throw new TypeError(`duplicate model rights repo id: ${repoId}`);
    repoIds.add(key);
  }
}

function assertEntry(rawEntry: unknown, label: string): string {
  const entry = objectValue(rawEntry, label);
  exactKeys(entry, [
    "repo_id",
    "revision",
    "origin",
    "upstream_url",
    "pin_sources",
    "files",
    "license",
    "class",
    "reviewer",
    "reviewed_on",
    "duties",
    "hub_flags",
    "drift",
    "reseed",
    "notes",
  ], label);

  const repoId = nonemptyString(entry.repo_id, `${label}.repo_id`);
  assertRepoId(repoId);
  if (!repoId.includes("/")) throw new TypeError(`${label}.repo_id must include an owner`);

  const revision = nonemptyString(entry.revision, `${label}.revision`);
  if (!SHA40.test(revision)) {
    throw new TypeError(`${label}.revision must be a 40-character lowercase hex commit`);
  }
  enumValue(entry.origin, MODEL_ORIGINS, `${label}.origin`);
  if (entry.upstream_url !== `${HUB_ORIGIN}/${repoId}/tree/${revision}`) {
    throw new TypeError(`${label}.upstream_url must be the commit-pinned tree URL`);
  }

  const pinSources = boundedArray(entry.pin_sources, `${label}.pin_sources`, 1, 8);
  for (const [index, source] of pinSources.entries()) {
    sourceRef(source, `${label}.pin_sources[${index}]`);
  }

  assertFiles(entry.files, repoId, revision, `${label}.files`);
  const licenseTag = assertLicense(entry.license, `${label}.license`);

  const rowClass = enumValue(entry.class, ROW_CLASSES, `${label}.class`);
  const duties = stringArray(entry.duties, `${label}.duties`, true);
  if (rowClass === "unreviewed") {
    if (entry.reviewer !== null || entry.reviewed_on !== null) {
      throw new TypeError(`${label} is unreviewed, so reviewer and reviewed_on must be null`);
    }
    if (duties.length !== 0) {
      throw new TypeError(`${label} is unreviewed, so duties must stay empty`);
    }
  } else {
    if (entry.reviewer === null) {
      throw new TypeError(`${label}.class ${rowClass} requires a named reviewer`);
    }
    nonemptyString(entry.reviewer, `${label}.reviewer`, 200);
    if (entry.reviewed_on === null) {
      throw new TypeError(`${label}.class ${rowClass} requires a reviewed_on date`);
    }
    isoDate(entry.reviewed_on, `${label}.reviewed_on`);
  }

  const flags = assertHubFlags(entry.hub_flags, `${label}.hub_flags`);
  if (
    (flags.gated === "auto" || flags.gated === "manual" || flags.private === true
      || flags.disabled === true)
    && rowClass !== "N"
    && rowClass !== "unreviewed"
  ) {
    throw new TypeError(`${label} is gated, private or disabled, so its class must be N`);
  }
  // P and T need a recorded basis: a declared licence tag at the pin, and Hub
  // flags that say the repository is not gated, private or disabled. Unknown
  // gating or an unrecorded licence leaves a row N or unreviewed.
  if (rowClass === "P" || rowClass === "T") {
    if (licenseTag === LICENSE_NOT_RECORDED) {
      throw new TypeError(`${label}.class ${rowClass} requires a recorded licence tag at the pin`);
    }
    if (flags.gated !== false || flags.private !== false || flags.disabled !== false) {
      throw new TypeError(
        `${label}.class ${rowClass} requires recorded Hub flags showing the repository is not gated, private or disabled`,
      );
    }
  }

  assertDrift(entry.drift, `${label}.drift`);
  if (entry.reseed !== "not-cleared") {
    throw new TypeError(`${label}.reseed must be not-cleared`);
  }
  stringArray(entry.notes, `${label}.notes`, true);
  return repoId;
}

function assertFiles(value: unknown, repoId: string, revision: string, label: string): void {
  if (value === "pending") return;
  if (typeof value === "string") {
    throw new TypeError(`${label} must be "pending" or a non-empty file list`);
  }
  const files = boundedArray(value, label, 1, 64);
  const paths = new Set<string>();
  for (const [index, rawFile] of files.entries()) {
    const fileLabel = `${label}[${index}]`;
    const file = objectValue(rawFile, fileLabel);
    exactKeys(file, [
      "path",
      "size",
      "sha256",
      "format",
      "external_data_check",
      "external_data_evidence",
      "upstream_url",
      "source",
    ], fileLabel);

    if (typeof file.format === "string" && isPickleFormatName(file.format)) {
      throw new TypeError(`${fileLabel}.format is a pickle format, which is never allowed`);
    }
    const path = nonemptyString(file.path, `${fileLabel}.path`, 512);
    if (
      !RELATIVE_PATH.test(path)
      || path.split("/").some((segment) => segment === "." || segment === "..")
    ) {
      throw new TypeError(`${fileLabel}.path must be a plain relative repository path`);
    }
    const lowerPath = path.toLowerCase();
    if (PICKLE_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
      throw new TypeError(`${fileLabel}.path names a pickle-based file, which is never allowed`);
    }
    if (paths.has(path)) throw new TypeError(`${label} must not repeat a path: ${path}`);
    paths.add(path);

    const size = file.size;
    if (!Number.isSafeInteger(size) || (size as number) < 1) {
      throw new TypeError(`${fileLabel}.size must be a positive integer byte count`);
    }
    const sha256 = nonemptyString(file.sha256, `${fileLabel}.sha256`);
    if (!SHA64.test(sha256)) {
      throw new TypeError(`${fileLabel}.sha256 must be 64 lowercase hex characters`);
    }
    const format = enumValue(file.format, FILE_FORMATS, `${fileLabel}.format`);
    if (!lowerPath.endsWith(FORMAT_EXTENSIONS[format])) {
      throw new TypeError(`${fileLabel}.path does not match its ${format} format`);
    }
    const check = enumValue(
      file.external_data_check,
      EXTERNAL_DATA_CHECKS,
      `${fileLabel}.external_data_check`,
    );
    if (format === "onnx" && check === "not-applicable") {
      throw new TypeError(`${fileLabel} is ONNX, so its external data check must be pending or recorded`);
    }
    if (format !== "onnx" && check !== "not-applicable") {
      throw new TypeError(`${fileLabel}.external_data_check applies only to ONNX files`);
    }
    // A completed check is a fact, so it needs its own date and source.
    if (check === "no-external-data") {
      if (file.external_data_evidence === null) {
        throw new TypeError(
          `${fileLabel}.external_data_evidence must record the date and source of the no-external-data check`,
        );
      }
      const evidence = objectValue(file.external_data_evidence, `${fileLabel}.external_data_evidence`);
      exactKeys(evidence, ["checked_on", "source"], `${fileLabel}.external_data_evidence`);
      isoDate(evidence.checked_on, `${fileLabel}.external_data_evidence.checked_on`);
      sourceRef(evidence.source, `${fileLabel}.external_data_evidence.source`);
    } else if (file.external_data_evidence !== null) {
      throw new TypeError(
        `${fileLabel}.external_data_evidence must be null until a no-external-data check is recorded`,
      );
    }
    if (file.upstream_url !== `${HUB_ORIGIN}/${repoId}/resolve/${revision}/${path}`) {
      throw new TypeError(`${fileLabel}.upstream_url must be the commit-pinned resolve URL`);
    }
    sourceRef(file.source, `${fileLabel}.source`);
  }
}

function assertLicense(value: unknown, label: string): string {
  const license = objectValue(value, label);
  exactKeys(license, ["tag_at_pin", "observed_on", "source"], label);
  const tag = nonemptyString(license.tag_at_pin, `${label}.tag_at_pin`, 128);
  if (tag === LICENSE_NOT_RECORDED) {
    if (license.observed_on !== null || license.source !== null) {
      throw new TypeError(`${label} is not recorded, so observed_on and source must be null`);
    }
    return tag;
  }
  if (!LICENSE_TAG.test(tag)) {
    throw new TypeError(`${label}.tag_at_pin must be a Hub licence tag or "${LICENSE_NOT_RECORDED}"`);
  }
  isoDate(license.observed_on, `${label}.observed_on`);
  sourceRef(license.source, `${label}.source`);
  return tag;
}

function assertHubFlags(value: unknown, label: string): ModelRightsHubFlags {
  const flags = objectValue(value, label);
  exactKeys(flags, ["gated", "private", "disabled", "observed_on", "source"], label);
  if (
    flags.gated !== null
    && flags.gated !== false
    && flags.gated !== "auto"
    && flags.gated !== "manual"
  ) {
    throw new TypeError(`${label}.gated must be false, "auto", "manual" or null`);
  }
  for (const key of ["private", "disabled"] as const) {
    if (flags[key] !== null && typeof flags[key] !== "boolean") {
      throw new TypeError(`${label}.${key} must be a boolean or null`);
    }
  }
  const unrecorded = flags.gated === null && flags.private === null && flags.disabled === null;
  if (unrecorded) {
    if (flags.observed_on !== null || flags.source !== null) {
      throw new TypeError(`${label} records no flag, so observed_on and source must be null`);
    }
  } else {
    isoDate(flags.observed_on, `${label}.observed_on`);
    sourceRef(flags.source, `${label}.source`);
  }
  return flags as unknown as ModelRightsHubFlags;
}

function assertDrift(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length > 256) {
    throw new TypeError(`${label} must be a bounded array`);
  }
  assertDenseDataArray(value, label);
  let previous = "";
  for (const [index, rawDrift] of value.entries()) {
    const driftLabel = `${label}[${index}]`;
    const drift = objectValue(rawDrift, driftLabel);
    exactKeys(drift, ["observed_on", "observation", "source"], driftLabel);
    const observedOn = isoDate(drift.observed_on, `${driftLabel}.observed_on`);
    if (observedOn < previous) {
      throw new TypeError(`${label} is append-only, so its dates must not go backwards`);
    }
    previous = observedOn;
    nonemptyString(drift.observation, `${driftLabel}.observation`);
    sourceRef(drift.source, `${driftLabel}.source`);
  }
}

function sourceRef(value: unknown, label: string): EstateSourceRef {
  const source = objectValue(value, label);
  exactKeys(source, ["repository", "path", "commit", "locator"], label);
  const repository = nonemptyString(source.repository, `${label}.repository`, 128);
  if (!SOURCE_REPOSITORY_SET.has(repository)) {
    throw new TypeError(
      `${label}.repository must be one of the source repositories this validator names: ${SOURCE_REPOSITORIES.join(", ")}`,
    );
  }
  const path = nonemptyString(source.path, `${label}.path`, 512);
  if (
    !RELATIVE_PATH.test(path)
    || path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new TypeError(`${label}.path must be a plain path inside that repository`);
  }
  const commit = nonemptyString(source.commit, `${label}.commit`);
  if (!SHA40.test(commit)) {
    throw new TypeError(`${label}.commit must be a 40-character lowercase hex commit`);
  }
  nonemptyString(source.locator, `${label}.locator`, 400);
  return source as unknown as EstateSourceRef;
}

function isPickleFormatName(format: string): boolean {
  const lower = format.trim().toLowerCase();
  return PICKLE_FORMAT_NAMES.has(lower) || lower.includes("pickle");
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = ownStringKeys(value, label).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])
  ) {
    throw new TypeError(`${label} must contain exactly: ${wanted.join(", ")}`);
  }
}

function ownStringKeys(value: Record<string, unknown>, label: string): string[] {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) {
    throw new TypeError(`${label} contains unexpected symbol fields`);
  }
  return keys as string[];
}

function assertDenseDataArray(value: unknown[], label: string): void {
  const keys = Reflect.ownKeys(value);
  const expected = new Set([
    "length",
    ...Array.from({ length: value.length }, (_, index) => String(index)),
  ]);
  if (
    keys.some((key) => typeof key !== "string" || !expected.has(key))
    || keys.length !== expected.size
  ) {
    throw new TypeError(`${label} must be a dense data-only array`);
  }
}

function boundedArray(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TypeError(`${label} must be an array of ${minimum}-${maximum} items`);
  }
  assertDenseDataArray(value, label);
  return value;
}

function nonemptyString(value: unknown, label: string, maximum = 4_000): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) {
    throw new TypeError(`${label} must be a bounded non-empty string`);
  }
  return value;
}

function isoDate(value: unknown, label: string): string {
  const text = nonemptyString(value, label, 10);
  if (
    !ISO_DATE.test(text)
    || Number.isNaN(Date.parse(`${text}T00:00:00Z`))
    || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text
  ) {
    throw new TypeError(`${label} must be a calendar date (YYYY-MM-DD)`);
  }
  return text;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new TypeError(`${label} must be one of: ${allowed.join(", ")}`);
  }
  return value as T[number];
}

function exactStrings(value: unknown, expected: readonly string[], label: string): void {
  const strings = stringArray(value, label);
  if (
    strings.length !== expected.length
    || strings.some((item, index) => item !== expected[index])
  ) {
    throw new TypeError(`${label} must be exactly: ${expected.join(", ")}`);
  }
}

function stringArray(value: unknown, label: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > 64) {
    throw new TypeError(`${label} must be a bounded string array`);
  }
  assertDenseDataArray(value, label);
  const strings = value.map((item, index) => nonemptyString(item, `${label}[${index}]`));
  if (new Set(strings).size !== strings.length) {
    throw new TypeError(`${label} must not contain duplicates`);
  }
  return strings;
}
