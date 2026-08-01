import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertRepoId,
  normalizePublicDatasetSnapshot,
  observePublicResource,
  type HubResourceSnapshot,
} from "./hub.ts";

export const TREASURE_PHASES = [
  "pretraining-order",
  "pretraining-recipe-selection",
  "pretraining-mixture-search",
  "quality-label-generation",
  "synthetic-data-planning",
  "contamination-audit",
  "midtraining-annealing",
  "provenance-audit",
  "multidimensional-quality",
  "reinforcement-learning-data-filtering",
  "data-attribution-evaluation",
  "agent-process-evaluation",
  "research-safety-evaluation",
  "memory-continuity-evaluation",
  "unlearning-evaluation",
] as const;

export const DISCOVERY_CLASSES = [
  "buried-artifact",
  "calibration-anchor",
] as const;

export const LICENSE_STATES = [
  "declared",
  "component-specific",
  "missing",
] as const;

export const VIEWER_STATES = [
  "ready",
  "partial",
  "unsupported",
  "encrypted",
  "broken",
] as const;

export const CONTENT_ROUTES = [
  "metadata-only",
  "schema-only",
  "aggregate-first",
  "bounded-sample-after-review",
  "sealed-eval-only",
] as const;

export type TreasurePhase = (typeof TREASURE_PHASES)[number];
export type DiscoveryClass = (typeof DISCOVERY_CLASSES)[number];
export type LicenseState = (typeof LICENSE_STATES)[number];
export type ViewerState = (typeof VIEWER_STATES)[number];
export type ContentRoute = (typeof CONTENT_ROUTES)[number];

export interface DatasetTreasure {
  rank: number;
  repo_id: string;
  hub_object_id: string;
  revision: string;
  canonical_url: string;
  phase: TreasurePhase;
  discovery_class: DiscoveryClass;
  hub_observation: {
    observed_at: string;
    last_modified: string;
    downloads: number;
    likes: number;
    hub_license_tag: string | null;
  };
  license: {
    status: LicenseState;
    expression: string | null;
    scope: string;
  };
  viewer: {
    status: ViewerState;
    configs: string[];
    schema: string[];
    note: string;
  };
  scale: string;
  treasure: string;
  kingdom_route: {
    mode: ContentRoute;
    next_artifact: string;
    does_not: string[];
  };
  known_drift: string[];
  risks: string[];
  primary_sources: string[];
}

export interface TreasureCatalogue {
  protocol: "hf-kingdom-dataset-treasures/v1";
  observed_at: string;
  purpose: string;
  boundary: {
    catalogue_is_evidence_not_authority: true;
    remote_rows_collected: false;
    remote_files_collected: false;
    hub_mutation: false;
    license_claims_are_publisher_assertions: true;
    popularity_is_not_quality: true;
  };
  entries: DatasetTreasure[];
}

export interface TreasureList {
  protocol: "hf-kingdom-dataset-treasure-list/v1";
  catalogue_protocol: TreasureCatalogue["protocol"];
  catalogue_observed_at: string;
  filter: {
    phase: TreasurePhase | null;
  };
  boundary: TreasureCatalogue["boundary"];
  entries: DatasetTreasure[];
}

export interface TreasureDriftReport {
  protocol: "hf-kingdom-dataset-treasure-drift/v1";
  checked_at: string;
  repo_id: string;
  pinned: {
    hub_object_id: string;
    revision: string;
    last_modified: string;
    hub_license_tag: string | null;
  };
  live: {
    hub_object_id: string;
    revision: string | null;
    last_modified: string;
    hub_license_tag: string | null;
    gated: false | "auto" | "manual" | null;
    disabled: boolean | null;
  };
  identity_changed: boolean;
  attention_delta: {
    downloads: number;
    likes: number;
  };
  boundary: {
    public_metadata_read_only: true;
    dataset_bodies_read: false;
    remote_writes: false;
  };
}

export interface ObserveTreasureOptions {
  observer?: (repoId: string) => Promise<HubResourceSnapshot>;
  now?: () => Date;
}

const DEFAULT_CATALOGUE_PATH = resolve(
  import.meta.dir,
  "..",
  "data",
  "dataset-treasures.v1.json",
);
const SHA40 = /^[0-9a-f]{40}$/;
const HUB_OBJECT_ID = /^[0-9a-f]{24}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ALLOWED_SOURCE_HOSTS = new Set([
  "arxiv.org",
  "github.com",
  "huggingface.co",
  "openreview.net",
]);

export async function loadTreasureCatalogue(
  path = DEFAULT_CATALOGUE_PATH,
): Promise<TreasureCatalogue> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  assertTreasureCatalogue(raw);
  return raw;
}

export function assertTreasureCatalogue(
  value: unknown,
): asserts value is TreasureCatalogue {
  const catalogue = objectValue(value, "catalogue");
  exactKeys(catalogue, [
    "protocol",
    "observed_at",
    "purpose",
    "boundary",
    "entries",
  ], "catalogue");
  if (catalogue.protocol !== "hf-kingdom-dataset-treasures/v1") {
    throw new TypeError("catalogue protocol must be hf-kingdom-dataset-treasures/v1");
  }
  isoInstant(catalogue.observed_at, "catalogue.observed_at");
  nonemptyString(catalogue.purpose, "catalogue.purpose");
  const boundary = objectValue(catalogue.boundary, "catalogue.boundary");
  exactKeys(boundary, [
    "catalogue_is_evidence_not_authority",
    "remote_rows_collected",
    "remote_files_collected",
    "hub_mutation",
    "license_claims_are_publisher_assertions",
    "popularity_is_not_quality",
  ], "catalogue.boundary");
  for (const key of [
    "catalogue_is_evidence_not_authority",
    "license_claims_are_publisher_assertions",
    "popularity_is_not_quality",
  ]) {
    if (boundary[key] !== true) throw new TypeError(`catalogue.boundary.${key} must be true`);
  }
  for (const key of ["remote_rows_collected", "remote_files_collected", "hub_mutation"]) {
    if (boundary[key] !== false) throw new TypeError(`catalogue.boundary.${key} must be false`);
  }
  if (!Array.isArray(catalogue.entries) || catalogue.entries.length === 0) {
    throw new TypeError("catalogue.entries must be a non-empty array");
  }
  assertDenseDataArray(catalogue.entries, "catalogue.entries");

  const repoIds = new Set<string>();
  const ranks = new Set<number>();
  for (const [index, rawEntry] of catalogue.entries.entries()) {
    const label = `catalogue.entries[${index}]`;
    const entry = objectValue(rawEntry, label);
    exactKeys(entry, [
      "rank",
      "repo_id",
      "hub_object_id",
      "revision",
      "canonical_url",
      "phase",
      "discovery_class",
      "hub_observation",
      "license",
      "viewer",
      "scale",
      "treasure",
      "kingdom_route",
      "known_drift",
      "risks",
      "primary_sources",
    ], label);
    const rank = positiveInteger(entry.rank, `${label}.rank`);
    if (ranks.has(rank)) throw new TypeError(`duplicate treasure rank: ${rank}`);
    ranks.add(rank);

    const repoId = nonemptyString(entry.repo_id, `${label}.repo_id`);
    assertRepoId(repoId);
    if (!repoId.includes("/")) throw new TypeError(`${label}.repo_id must include an owner`);
    if (repoIds.has(repoId)) throw new TypeError(`duplicate treasure repo id: ${repoId}`);
    repoIds.add(repoId);

    const hubObjectId = nonemptyString(entry.hub_object_id, `${label}.hub_object_id`);
    if (!HUB_OBJECT_ID.test(hubObjectId)) {
      throw new TypeError(`${label}.hub_object_id must be a 24-character lowercase hex id`);
    }

    const revision = nonemptyString(entry.revision, `${label}.revision`);
    if (!SHA40.test(revision)) throw new TypeError(`${label}.revision must be a 40-character SHA`);
    const canonicalUrl = nonemptyString(entry.canonical_url, `${label}.canonical_url`);
    if (canonicalUrl !== `https://huggingface.co/datasets/${repoId}`) {
      throw new TypeError(`${label}.canonical_url does not match repo_id`);
    }
    enumValue(entry.phase, TREASURE_PHASES, `${label}.phase`);
    enumValue(entry.discovery_class, DISCOVERY_CLASSES, `${label}.discovery_class`);

    const observation = objectValue(entry.hub_observation, `${label}.hub_observation`);
    exactKeys(observation, [
      "observed_at",
      "last_modified",
      "downloads",
      "likes",
      "hub_license_tag",
    ], `${label}.hub_observation`);
    isoInstant(observation.observed_at, `${label}.hub_observation.observed_at`);
    isoInstant(observation.last_modified, `${label}.hub_observation.last_modified`);
    nonnegativeInteger(observation.downloads, `${label}.hub_observation.downloads`);
    nonnegativeInteger(observation.likes, `${label}.hub_observation.likes`);
    const hubLicenseTag = nullableString(
      observation.hub_license_tag,
      `${label}.hub_observation.hub_license_tag`,
    );
    if (hubLicenseTag !== null && !/^license:[a-z0-9.-]+$/.test(hubLicenseTag)) {
      throw new TypeError(`${label}.hub_observation.hub_license_tag is invalid`);
    }

    const license = objectValue(entry.license, `${label}.license`);
    exactKeys(license, ["status", "expression", "scope"], `${label}.license`);
    const licenseStatus = enumValue(
      license.status,
      LICENSE_STATES,
      `${label}.license.status`,
    );
    const licenseExpression = nullableString(
      license.expression,
      `${label}.license.expression`,
    );
    nonemptyString(license.scope, `${label}.license.scope`);
    if (licenseStatus === "declared" && licenseExpression === null) {
      throw new TypeError(`${label}.license.expression is required for a declared licence`);
    }
    if (licenseStatus === "missing" && licenseExpression !== null) {
      throw new TypeError(`${label}.license.expression must be null when licence metadata is missing`);
    }
    if (licenseStatus === "declared" && hubLicenseTag === null) {
      throw new TypeError(`${label} cannot declare a licence absent from the observed Hub tag`);
    }
    if (licenseStatus === "missing" && hubLicenseTag !== null) {
      throw new TypeError(`${label} cannot mark an observed Hub licence tag as missing`);
    }
    if (
      licenseExpression !== null
      && hubLicenseTag !== null
      && !licenseExpression.toLowerCase().includes(hubLicenseTag.slice("license:".length))
    ) {
      throw new TypeError(`${label}.license.expression conflicts with the observed Hub tag`);
    }

    const viewer = objectValue(entry.viewer, `${label}.viewer`);
    exactKeys(viewer, ["status", "configs", "schema", "note"], `${label}.viewer`);
    const viewerStatus = enumValue(viewer.status, VIEWER_STATES, `${label}.viewer.status`);
    stringArray(viewer.configs, `${label}.viewer.configs`, true);
    stringArray(viewer.schema, `${label}.viewer.schema`, true);
    nonemptyString(viewer.note, `${label}.viewer.note`);

    nonemptyString(entry.scale, `${label}.scale`);
    nonemptyString(entry.treasure, `${label}.treasure`);
    const route = objectValue(entry.kingdom_route, `${label}.kingdom_route`);
    exactKeys(route, ["mode", "next_artifact", "does_not"], `${label}.kingdom_route`);
    const mode = enumValue(route.mode, CONTENT_ROUTES, `${label}.kingdom_route.mode`);
    nonemptyString(route.next_artifact, `${label}.kingdom_route.next_artifact`);
    stringArray(route.does_not, `${label}.kingdom_route.does_not`);
    stringArray(entry.known_drift, `${label}.known_drift`, true);
    stringArray(entry.risks, `${label}.risks`);
    const sources = stringArray(entry.primary_sources, `${label}.primary_sources`);
    for (const source of sources) {
      const url = new URL(source);
      if (url.protocol !== "https:" || !ALLOWED_SOURCE_HOSTS.has(url.hostname)) {
        throw new TypeError(`${label}.primary_sources contains an unsupported host`);
      }
    }

    if (
      licenseStatus === "missing"
      && !(["metadata-only", "schema-only"] as ContentRoute[]).includes(mode)
    ) {
      throw new TypeError(`${label} cannot route missing-licence content beyond metadata/schema`);
    }
    if (
      licenseStatus === "component-specific"
      && !(["metadata-only", "schema-only", "aggregate-first"] as ContentRoute[]).includes(mode)
    ) {
      throw new TypeError(`${label} cannot route component-specific content to sample/eval use`);
    }
    if (
      (["unsupported", "broken", "encrypted"] as ViewerState[]).includes(viewerStatus)
      && (["aggregate-first", "bounded-sample-after-review"] as ContentRoute[]).includes(mode)
    ) {
      throw new TypeError(`${label} requires a usable Viewer before its selected content route`);
    }
    if (mode === "sealed-eval-only" && !(["ready", "encrypted"] as ViewerState[]).includes(viewerStatus)) {
      throw new TypeError(`${label} sealed eval route requires a ready or encrypted artifact`);
    }
  }

  const expectedRanks = catalogue.entries.map((_, index) => index + 1);
  if (!expectedRanks.every((rank) => ranks.has(rank))) {
    throw new TypeError("treasure ranks must be contiguous from 1");
  }
}

export function listTreasures(
  catalogue: TreasureCatalogue,
  phase?: TreasurePhase,
): DatasetTreasure[] {
  return catalogue.entries
    .filter((entry) => phase === undefined || entry.phase === phase)
    .sort((left, right) => left.rank - right.rank);
}

export function buildTreasureList(
  catalogue: TreasureCatalogue,
  phase?: TreasurePhase,
): TreasureList {
  return {
    protocol: "hf-kingdom-dataset-treasure-list/v1",
    catalogue_protocol: catalogue.protocol,
    catalogue_observed_at: catalogue.observed_at,
    filter: { phase: phase ?? null },
    boundary: catalogue.boundary,
    entries: listTreasures(catalogue, phase),
  };
}

export function findTreasure(
  catalogue: TreasureCatalogue,
  repoId: string,
): DatasetTreasure {
  const treasure = catalogue.entries.find((entry) => entry.repo_id === repoId);
  if (!treasure) {
    throw new TypeError("repo id must exactly match a curated dataset treasure");
  }
  return treasure;
}

export async function observeTreasure(
  treasure: DatasetTreasure,
  options: ObserveTreasureOptions = {},
): Promise<{ snapshot: HubResourceSnapshot; drift: TreasureDriftReport }> {
  const observer = options.observer
    ?? ((repoId: string) => observePublicResource("dataset", repoId));
  const observedSnapshot = await observer(treasure.repo_id);
  const snapshot = normalizePublicDatasetSnapshot(observedSnapshot, {
    repo_id: treasure.repo_id,
    canonical_url: treasure.canonical_url,
    hub_object_id: treasure.hub_object_id,
    observer_label: "treasure",
  });
  const resource = snapshot.resource;
  const liveLicenseTag = extractLicenseTag(resource.tags);
  const liveRevision = resource.revision ?? null;
  const liveGated = resource.gated ?? null;
  const liveDisabled = resource.disabled ?? null;
  const drift: TreasureDriftReport = {
    protocol: "hf-kingdom-dataset-treasure-drift/v1",
    checked_at: validNow(options.now ?? (() => new Date())).toISOString(),
    repo_id: treasure.repo_id,
    pinned: {
      hub_object_id: treasure.hub_object_id,
      revision: treasure.revision,
      last_modified: treasure.hub_observation.last_modified,
      hub_license_tag: treasure.hub_observation.hub_license_tag,
    },
    live: {
      hub_object_id: resource.hub_object_id,
      revision: liveRevision,
      last_modified: resource.updated_at,
      hub_license_tag: liveLicenseTag,
      gated: liveGated,
      disabled: liveDisabled,
    },
    identity_changed:
      resource.hub_object_id !== treasure.hub_object_id
      || liveRevision !== treasure.revision
      || resource.updated_at !== treasure.hub_observation.last_modified
      || liveLicenseTag !== treasure.hub_observation.hub_license_tag
      || liveGated !== false
      || liveDisabled !== false,
    attention_delta: {
      downloads: (resource.downloads ?? 0) - treasure.hub_observation.downloads,
      likes: resource.likes - treasure.hub_observation.likes,
    },
    boundary: {
      public_metadata_read_only: true,
      dataset_bodies_read: false,
      remote_writes: false,
    },
  };
  return { snapshot, drift };
}

function extractLicenseTag(tags: string[] | undefined): string | null {
  const licenses = (tags ?? []).filter((tag) => tag.startsWith("license:"));
  if (licenses.length > 1) {
    throw new Error("treasure observer returned multiple Hub licence tags");
  }
  return licenses[0] ?? null;
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

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 4_000) {
    throw new TypeError(`${label} must be a bounded non-empty string`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return nonemptyString(value, label);
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value as number;
}

function nonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value as number;
}

function isoInstant(value: unknown, label: string): string {
  const text = nonemptyString(value, label);
  if (!ISO_INSTANT.test(text) || Number.isNaN(Date.parse(text))) {
    throw new TypeError(`${label} must be an ISO UTC instant`);
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

function validNow(now: () => Date): Date {
  const value = now();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("now() must return a valid Date");
  }
  return value;
}
