import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertRepoId,
  normalizePublicDatasetSnapshot,
  observePublicResource,
  type HubResourceSnapshot,
} from "./hub.ts";

export const FLOW_DOMAINS = [
  "conversation",
  "music",
  "writing",
  "visual-art",
] as const;

export const FLOW_ROLES = [
  "hidden-gem",
  "control-artifact",
  "calibration-anchor",
] as const;

export const FLOW_AXES = [
  "preference-pair",
  "repeated-observer",
  "culture-language",
  "perspective-synthesis",
  "conversation-branch",
  "turn-sequence",
  "localized-region",
  "rubric-grid",
  "continuous-time",
] as const;

export const VIBE_DIMENSIONS = [
  "intent-constraint",
  "form-style",
  "affect-resonance",
  "coherence-craft",
  "novelty-surprise",
  "cultural-linguistic-situation",
  "agency-consent",
  "trajectory-repair",
  "disagreement-tie",
  "uncertainty-evidence",
] as const;

export const EPISTEMIC_LAYERS = [
  "descriptive",
  "normative",
  "control",
] as const;

export const OBSERVER_ORIGINS = ["human", "model", "mixed"] as const;
export const IDENTITY_SURFACES = [
  "none",
  "pseudonymous",
  "sensitive-pseudonymous",
] as const;
export const DISAGREEMENT_STATES = [
  "preserved",
  "partially-preserved",
  "aggregated-away",
  "not-applicable",
] as const;
export const FLOW_LICENSE_STATES = [
  "declared",
  "component-specific",
  "conflicting",
  "custom",
] as const;
export const FLOW_VIEWER_STATES = [
  "ready",
  "partial",
  "mismatched",
  "unsupported",
] as const;
export const FLOW_ROUTES = [
  "metadata-only",
  "schema-only",
  "aggregate-after-review",
  "bounded-sample-after-review",
] as const;

export type FlowDomain = (typeof FLOW_DOMAINS)[number];
export type FlowRole = (typeof FLOW_ROLES)[number];
export type FlowAxis = (typeof FLOW_AXES)[number];
export type VibeDimension = (typeof VIBE_DIMENSIONS)[number];
export type EpistemicLayer = (typeof EPISTEMIC_LAYERS)[number];
export type ObserverOrigin = (typeof OBSERVER_ORIGINS)[number];
export type IdentitySurface = (typeof IDENTITY_SURFACES)[number];
export type DisagreementState = (typeof DISAGREEMENT_STATES)[number];
export type FlowLicenseState = (typeof FLOW_LICENSE_STATES)[number];
export type FlowViewerState = (typeof FLOW_VIEWER_STATES)[number];
export type FlowRoute = (typeof FLOW_ROUTES)[number];

export interface FlowLens {
  rank: number;
  repo_id: string;
  hub_object_id: string;
  revision: string;
  canonical_url: string;
  domain: FlowDomain;
  role: FlowRole;
  hub_observation: {
    last_modified: string;
    downloads: number;
    likes: number;
    hub_license_tag: string;
  };
  license: {
    status: FlowLicenseState;
    expression: string;
    scope: string;
  };
  evidence: {
    observer_origin: ObserverOrigin;
    epistemic_layers: EpistemicLayer[];
    identity_surface: IdentitySurface;
    observation_unit: string;
    dimensions: VibeDimension[];
    disagreement: DisagreementState;
  };
  flow: {
    axis: FlowAxis;
    stages: string[];
    preserves: string[];
    loses: string[];
  };
  viewer: {
    status: FlowViewerState;
    configs: string[];
    reported_rows: string;
    schema: string[];
    note: string;
  };
  route: {
    mode: FlowRoute;
    next_artifact: string;
    forbidden: string[];
  };
  nuances: string[];
  risks: string[];
  primary_sources: string[];
}

export interface FlowLensCatalogue {
  protocol: "hf-kingdom-flow-lenses/v1";
  observed_at: string;
  purpose: string;
  definition: {
    flow: string;
    vibe: string;
  };
  boundary: {
    catalogue_is_evidence_not_authority: true;
    disagreement_is_data: true;
    descriptive_normative_and_control_layers_stay_distinct: true;
    no_universal_vibe_score: true;
    no_person_worth_or_identity_inference: true;
    no_demographic_taste_inference: true;
    remote_rows_collected: false;
    remote_files_collected: false;
    hub_mutation: false;
  };
  dimensions: VibeDimension[];
  entries: FlowLens[];
}

export interface FlowLensList {
  protocol: "hf-kingdom-flow-lens-list/v1";
  catalogue_observed_at: string;
  filter: { domain: FlowDomain | null; role: FlowRole | null };
  boundary: FlowLensCatalogue["boundary"];
  entries: FlowLens[];
}

export interface FlowTrace {
  protocol: "hf-kingdom-flow-trace/v1";
  repo_id: string;
  revision: string;
  domain: FlowDomain;
  axis: FlowAxis;
  observation_unit: string;
  observer_origin: ObserverOrigin;
  epistemic_layers: EpistemicLayer[];
  dimensions: VibeDimension[];
  stages: Array<{ order: number; description: string }>;
  preserves: string[];
  loses: string[];
  uncertainty_evidence: {
    nuances: string[];
    risks: string[];
    viewer_status: FlowViewerState;
    viewer_note: string;
  };
  interpretation_boundary: {
    situated_observation_not_essence: true;
    no_universal_score: true;
    forbidden: string[];
  };
}

export interface FlowLensDriftReport {
  protocol: "hf-kingdom-flow-lens-drift/v1";
  checked_at: string;
  repo_id: string;
  pinned: {
    hub_object_id: string;
    revision: string;
    last_modified: string;
    hub_license_tag: string;
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
  attention_delta: { downloads: number; likes: number };
  boundary: {
    public_metadata_read_only: true;
    dataset_bodies_read: false;
    remote_writes: false;
  };
}

export interface ObserveFlowLensOptions {
  observer?: (repoId: string) => Promise<HubResourceSnapshot>;
  now?: () => Date;
}

const DEFAULT_CATALOGUE_PATH = resolve(
  import.meta.dir,
  "..",
  "data",
  "flow-lenses.v1.json",
);
const SHA40 = /^[0-9a-f]{40}$/;
const HUB_OBJECT_ID = /^[0-9a-f]{24}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ALLOWED_SOURCE_HOSTS = new Set([
  "arxiv.org",
  "huggingface.co",
]);

export async function loadFlowLensCatalogue(
  path = DEFAULT_CATALOGUE_PATH,
): Promise<FlowLensCatalogue> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  assertFlowLensCatalogue(raw);
  return raw;
}

export function assertFlowLensCatalogue(
  value: unknown,
): asserts value is FlowLensCatalogue {
  const catalogue = objectValue(value, "catalogue");
  exactKeys(catalogue, [
    "protocol",
    "observed_at",
    "purpose",
    "definition",
    "boundary",
    "dimensions",
    "entries",
  ], "catalogue");
  if (catalogue.protocol !== "hf-kingdom-flow-lenses/v1") {
    throw new TypeError("catalogue protocol must be hf-kingdom-flow-lenses/v1");
  }
  isoInstant(catalogue.observed_at, "catalogue.observed_at");
  nonemptyString(catalogue.purpose, "catalogue.purpose");
  const definition = objectValue(catalogue.definition, "catalogue.definition");
  exactKeys(definition, ["flow", "vibe"], "catalogue.definition");
  nonemptyString(definition.flow, "catalogue.definition.flow");
  const vibeDefinition = nonemptyString(definition.vibe, "catalogue.definition.vibe");
  if (!/situated/i.test(vibeDefinition) || !/never/i.test(vibeDefinition)) {
    throw new TypeError("catalogue.definition.vibe must preserve situated and non-essential meaning");
  }

  const boundary = objectValue(catalogue.boundary, "catalogue.boundary");
  exactKeys(boundary, [
    "catalogue_is_evidence_not_authority",
    "disagreement_is_data",
    "descriptive_normative_and_control_layers_stay_distinct",
    "no_universal_vibe_score",
    "no_person_worth_or_identity_inference",
    "no_demographic_taste_inference",
    "remote_rows_collected",
    "remote_files_collected",
    "hub_mutation",
  ], "catalogue.boundary");
  for (const key of [
    "catalogue_is_evidence_not_authority",
    "disagreement_is_data",
    "descriptive_normative_and_control_layers_stay_distinct",
    "no_universal_vibe_score",
    "no_person_worth_or_identity_inference",
    "no_demographic_taste_inference",
  ]) {
    if (boundary[key] !== true) {
      throw new TypeError(`catalogue.boundary.${key} must be true`);
    }
  }
  for (const key of ["remote_rows_collected", "remote_files_collected", "hub_mutation"]) {
    if (boundary[key] !== false) {
      throw new TypeError(`catalogue.boundary.${key} must be false`);
    }
  }

  const dimensions = enumArray(
    catalogue.dimensions,
    VIBE_DIMENSIONS,
    "catalogue.dimensions",
  );
  if (
    dimensions.length !== VIBE_DIMENSIONS.length
    || dimensions.some((dimension, index) => dimension !== VIBE_DIMENSIONS[index])
  ) {
    throw new TypeError("catalogue.dimensions must declare the complete ordered lens vocabulary");
  }

  if (!Array.isArray(catalogue.entries) || catalogue.entries.length === 0) {
    throw new TypeError("catalogue.entries must be a non-empty array");
  }
  const repoIds = new Set<string>();
  for (const [index, rawEntry] of catalogue.entries.entries()) {
    validateEntry(rawEntry, index, repoIds);
  }
}

function validateEntry(rawEntry: unknown, index: number, repoIds: Set<string>): void {
  const label = `catalogue.entries[${index}]`;
  const entry = objectValue(rawEntry, label);
  exactKeys(entry, [
    "rank",
    "repo_id",
    "hub_object_id",
    "revision",
    "canonical_url",
    "domain",
    "role",
    "hub_observation",
    "license",
    "evidence",
    "flow",
    "viewer",
    "route",
    "nuances",
    "risks",
    "primary_sources",
  ], label);
  if (positiveInteger(entry.rank, `${label}.rank`) !== index + 1) {
    throw new TypeError(`${label}.rank must be consecutive and match catalogue order`);
  }
  const repoId = nonemptyString(entry.repo_id, `${label}.repo_id`);
  assertRepoId(repoId);
  if (!repoId.includes("/")) throw new TypeError(`${label}.repo_id must include an owner`);
  if (repoIds.has(repoId)) throw new TypeError(`duplicate flow-lens repo id: ${repoId}`);
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
  enumValue(entry.domain, FLOW_DOMAINS, `${label}.domain`);
  enumValue(entry.role, FLOW_ROLES, `${label}.role`);

  const observation = objectValue(entry.hub_observation, `${label}.hub_observation`);
  exactKeys(observation, [
    "last_modified",
    "downloads",
    "likes",
    "hub_license_tag",
  ], `${label}.hub_observation`);
  isoInstant(observation.last_modified, `${label}.hub_observation.last_modified`);
  nonnegativeInteger(observation.downloads, `${label}.hub_observation.downloads`);
  nonnegativeInteger(observation.likes, `${label}.hub_observation.likes`);
  const hubLicenseTag = nonemptyString(
    observation.hub_license_tag,
    `${label}.hub_observation.hub_license_tag`,
  );
  if (!/^license:[a-z0-9.-]+$/.test(hubLicenseTag)) {
    throw new TypeError(`${label}.hub_observation.hub_license_tag is invalid`);
  }

  const license = objectValue(entry.license, `${label}.license`);
  exactKeys(license, ["status", "expression", "scope"], `${label}.license`);
  const licenseStatus = enumValue(
    license.status,
    FLOW_LICENSE_STATES,
    `${label}.license.status`,
  );
  const licenseExpression = nonemptyString(
    license.expression,
    `${label}.license.expression`,
  );
  nonemptyString(license.scope, `${label}.license.scope`);
  if (
    licenseStatus === "declared"
    && !licenseExpression.toLowerCase().includes(hubLicenseTag.slice("license:".length))
  ) {
    throw new TypeError(`${label}.license.expression conflicts with the declared Hub tag`);
  }

  const evidence = objectValue(entry.evidence, `${label}.evidence`);
  exactKeys(evidence, [
    "observer_origin",
    "epistemic_layers",
    "identity_surface",
    "observation_unit",
    "dimensions",
    "disagreement",
  ], `${label}.evidence`);
  const observerOrigin = enumValue(
    evidence.observer_origin,
    OBSERVER_ORIGINS,
    `${label}.evidence.observer_origin`,
  );
  const epistemicLayers = enumArray(
    evidence.epistemic_layers,
    EPISTEMIC_LAYERS,
    `${label}.evidence.epistemic_layers`,
  );
  const identitySurface = enumValue(
    evidence.identity_surface,
    IDENTITY_SURFACES,
    `${label}.evidence.identity_surface`,
  );
  nonemptyString(evidence.observation_unit, `${label}.evidence.observation_unit`);
  enumArray(evidence.dimensions, VIBE_DIMENSIONS, `${label}.evidence.dimensions`);
  enumValue(
    evidence.disagreement,
    DISAGREEMENT_STATES,
    `${label}.evidence.disagreement`,
  );
  if (observerOrigin === "model" && epistemicLayers.includes("normative")) {
    throw new TypeError(`${label} cannot label model-only evidence as a normative human preference`);
  }

  const flow = objectValue(entry.flow, `${label}.flow`);
  exactKeys(flow, ["axis", "stages", "preserves", "loses"], `${label}.flow`);
  enumValue(flow.axis, FLOW_AXES, `${label}.flow.axis`);
  boundedStringArray(flow.stages, `${label}.flow.stages`, 2, 8);
  boundedStringArray(flow.preserves, `${label}.flow.preserves`, 1, 16);
  boundedStringArray(flow.loses, `${label}.flow.loses`, 1, 16);

  const viewer = objectValue(entry.viewer, `${label}.viewer`);
  exactKeys(viewer, [
    "status",
    "configs",
    "reported_rows",
    "schema",
    "note",
  ], `${label}.viewer`);
  const viewerStatus = enumValue(
    viewer.status,
    FLOW_VIEWER_STATES,
    `${label}.viewer.status`,
  );
  boundedStringArray(viewer.configs, `${label}.viewer.configs`, 0, 32);
  nonemptyString(viewer.reported_rows, `${label}.viewer.reported_rows`);
  boundedStringArray(viewer.schema, `${label}.viewer.schema`, 1, 64);
  nonemptyString(viewer.note, `${label}.viewer.note`);

  const route = objectValue(entry.route, `${label}.route`);
  exactKeys(route, ["mode", "next_artifact", "forbidden"], `${label}.route`);
  const routeMode = enumValue(route.mode, FLOW_ROUTES, `${label}.route.mode`);
  nonemptyString(route.next_artifact, `${label}.route.next_artifact`);
  const forbidden = boundedStringArray(route.forbidden, `${label}.route.forbidden`, 1, 32);
  if (!forbidden.includes("universal-vibe-score")) {
    throw new TypeError(`${label}.route.forbidden must include universal-vibe-score`);
  }
  if (
    (licenseStatus === "conflicting" || licenseStatus === "custom")
    && routeMode !== "metadata-only"
    && routeMode !== "schema-only"
  ) {
    throw new TypeError(`${label} cannot route conflicting/custom-licence content beyond metadata/schema`);
  }
  if (
    licenseStatus === "component-specific"
    && routeMode === "bounded-sample-after-review"
  ) {
    throw new TypeError(`${label} cannot sample component-specific content before component clearance`);
  }
  if (
    viewerStatus === "mismatched"
    && routeMode !== "metadata-only"
    && routeMode !== "schema-only"
  ) {
    throw new TypeError(`${label} cannot aggregate/sample before resolving a Viewer representation mismatch`);
  }
  if (identitySurface !== "none" && !forbidden.includes("reidentification")) {
    throw new TypeError(`${label} must explicitly forbid reidentification`);
  }
  if (
    identitySurface === "sensitive-pseudonymous"
    && !forbidden.includes("demographic-inference")
  ) {
    throw new TypeError(`${label} must explicitly forbid demographic inference`);
  }
  if (
    identitySurface === "sensitive-pseudonymous"
    && routeMode === "bounded-sample-after-review"
  ) {
    throw new TypeError(`${label} cannot sample a sensitive pseudonymous surface`);
  }
  if (observerOrigin === "model" && !forbidden.includes("human-ground-truth-claim")) {
    throw new TypeError(`${label} must forbid treating model-only evidence as human ground truth`);
  }

  boundedStringArray(entry.nuances, `${label}.nuances`, 1, 16);
  boundedStringArray(entry.risks, `${label}.risks`, 1, 32);
  const sources = boundedStringArray(entry.primary_sources, `${label}.primary_sources`, 1, 16);
  for (const [sourceIndex, source] of sources.entries()) {
    let parsed: URL;
    try {
      parsed = new URL(source);
    } catch {
      throw new TypeError(`${label}.primary_sources[${sourceIndex}] must be a URL`);
    }
    if (parsed.protocol !== "https:" || !ALLOWED_SOURCE_HOSTS.has(parsed.hostname)) {
      throw new TypeError(`${label}.primary_sources[${sourceIndex}] uses an unapproved host`);
    }
  }
}

export function listFlowLenses(
  catalogue: FlowLensCatalogue,
  filters: { domain?: FlowDomain; role?: FlowRole } = {},
): FlowLens[] {
  return catalogue.entries.filter((entry) =>
    (filters.domain === undefined || entry.domain === filters.domain)
    && (filters.role === undefined || entry.role === filters.role)
  );
}

export function buildFlowLensList(
  catalogue: FlowLensCatalogue,
  filters: { domain?: FlowDomain; role?: FlowRole } = {},
): FlowLensList {
  return {
    protocol: "hf-kingdom-flow-lens-list/v1",
    catalogue_observed_at: catalogue.observed_at,
    filter: {
      domain: filters.domain ?? null,
      role: filters.role ?? null,
    },
    boundary: catalogue.boundary,
    entries: listFlowLenses(catalogue, filters),
  };
}

export function findFlowLens(
  catalogue: FlowLensCatalogue,
  repoId: string,
): FlowLens {
  const entry = catalogue.entries.find((candidate) => candidate.repo_id === repoId);
  if (!entry) {
    throw new Error("repo id must exactly match a curated flow lens");
  }
  return entry;
}

export function buildFlowTrace(entry: FlowLens): FlowTrace {
  return {
    protocol: "hf-kingdom-flow-trace/v1",
    repo_id: entry.repo_id,
    revision: entry.revision,
    domain: entry.domain,
    axis: entry.flow.axis,
    observation_unit: entry.evidence.observation_unit,
    observer_origin: entry.evidence.observer_origin,
    epistemic_layers: [...entry.evidence.epistemic_layers],
    dimensions: [...entry.evidence.dimensions],
    stages: entry.flow.stages.map((description, index) => ({
      order: index + 1,
      description,
    })),
    preserves: [...entry.flow.preserves],
    loses: [...entry.flow.loses],
    uncertainty_evidence: {
      nuances: [...entry.nuances],
      risks: [...entry.risks],
      viewer_status: entry.viewer.status,
      viewer_note: entry.viewer.note,
    },
    interpretation_boundary: {
      situated_observation_not_essence: true,
      no_universal_score: true,
      forbidden: [...entry.route.forbidden],
    },
  };
}

export async function observeFlowLens(
  entry: FlowLens,
  options: ObserveFlowLensOptions = {},
): Promise<{ snapshot: HubResourceSnapshot; drift: FlowLensDriftReport }> {
  const observer = options.observer ?? ((repoId: string) =>
    observePublicResource("dataset", repoId));
  const observedSnapshot = await observer(entry.repo_id);
  const snapshot = normalizePublicDatasetSnapshot(observedSnapshot, {
    repo_id: entry.repo_id,
    canonical_url: entry.canonical_url,
    hub_object_id: entry.hub_object_id,
    observer_label: "flow-lens",
  });
  const now = validNow(options.now ?? (() => new Date())).toISOString();
  const resource = snapshot.resource;
  const liveLicenseTag = extractLicenseTag(resource.tags);
  const liveRevision = resource.revision ?? null;
  const liveGated = resource.gated ?? null;
  const liveDisabled = resource.disabled ?? null;
  const drift: FlowLensDriftReport = {
    protocol: "hf-kingdom-flow-lens-drift/v1",
    checked_at: now,
    repo_id: entry.repo_id,
    pinned: {
      hub_object_id: entry.hub_object_id,
      revision: entry.revision,
      last_modified: entry.hub_observation.last_modified,
      hub_license_tag: entry.hub_observation.hub_license_tag,
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
      resource.hub_object_id !== entry.hub_object_id
      || liveRevision !== entry.revision
      || resource.updated_at !== entry.hub_observation.last_modified
      || liveLicenseTag !== entry.hub_observation.hub_license_tag
      || liveGated !== false
      || liveDisabled !== false,
    attention_delta: {
      downloads: (resource.downloads ?? 0) - entry.hub_observation.downloads,
      likes: resource.likes - entry.hub_observation.likes,
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
    throw new Error("flow-lens observer returned multiple Hub licence tags");
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

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 8_000) {
    throw new TypeError(`${label} must be a bounded non-empty string`);
  }
  return value;
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

function enumArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number][] {
  const values = boundedStringArray(value, label, 1, allowed.length);
  for (const candidate of values) {
    if (!allowed.includes(candidate)) {
      throw new TypeError(`${label} contains unknown value: ${candidate}`);
    }
  }
  return values as T[number][];
}

function boundedStringArray(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TypeError(`${label} must contain ${minimum}-${maximum} strings`);
  }
  const values = value.map((item, index) => nonemptyString(item, `${label}[${index}]`));
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${label} must not contain duplicates`);
  }
  return values;
}

function validNow(now: () => Date): Date {
  const value = now();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("now() must return a valid Date");
  }
  return value;
}
