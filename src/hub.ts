import {
  datasetInfo,
  modelInfo,
  spaceInfo,
} from "@huggingface/hub";

export const RESOURCE_KINDS = ["model", "dataset", "space"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export interface HubResource {
  resource_type: ResourceKind;
  repo_id: string;
  canonical_url: string;
  hub_object_id: string;
  private: false;
  likes: number;
  updated_at: string;
  author?: string;
  created_at?: string;
  disabled?: boolean;
  revision?: string;
  tags?: string[];
  gated?: false | "auto" | "manual";
  downloads?: number;
  task?: string;
  library?: string;
  safetensors_total_parameters?: number;
  sdk?: string;
  runtime_stage?: string;
  hardware_current?: string | null;
  hardware_requested?: string | null;
  linked_models?: string[];
  linked_datasets?: string[];
  arrays_truncated?: boolean;
}

export interface HubResourceSnapshot {
  protocol: "hf-kingdom-resource/v1";
  resource: HubResource;
  observation_boundary: {
    access: "public-read-without-token";
    transport: "@huggingface/hub";
    assertions_are_untrusted: true;
    private_resources_in_scope: false;
    hub_mutation_in_scope: false;
  };
}

export interface PublicDatasetSnapshotIdentity {
  repo_id: string;
  canonical_url: string;
  hub_object_id: string;
  observer_label: string;
}

export interface ObserveOptions {
  fetch?: typeof fetch;
}

const MAX_REPO_ID_LENGTH = 160;
const MAX_ARRAY_ITEMS = 100;
const MAX_PUBLIC_DATASET_AUTHOR_LENGTH = 256;
const MAX_PUBLIC_DATASET_TAG_LENGTH = 512;
const REPO_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/;
const SNAPSHOT_SHA40 = /^[a-f0-9]{40}$/u;
const SNAPSHOT_ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export function assertResourceKind(value: string): asserts value is ResourceKind {
  if (!RESOURCE_KINDS.includes(value as ResourceKind)) {
    throw new TypeError(`resource type must be one of: ${RESOURCE_KINDS.join(", ")}`);
  }
}

export function assertRepoId(value: string): void {
  if (
    value.length === 0
    || value.length > MAX_REPO_ID_LENGTH
    || !REPO_ID.test(value)
    || value.includes("..")
  ) {
    throw new TypeError("repo id must be a bounded Hugging Face owner/name or name");
  }
}

export async function observePublicResource(
  kind: ResourceKind,
  repoId: string,
  options: ObserveOptions = {},
): Promise<HubResourceSnapshot> {
  assertRepoId(repoId);
  const common = {
    name: repoId,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  };

  let resource: HubResource;
  switch (kind) {
    case "model": {
      const info = await modelInfo({
        ...common,
        additionalFields: [
          "author",
          "createdAt",
          "disabled",
          "library_name",
          "safetensors",
          "sha",
          "tags",
        ],
      });
      rejectPrivate(info.private);
      const tags = boundedStrings(info.tags);
      resource = {
        resource_type: kind,
        repo_id: info.name,
        canonical_url: resourceUrl(kind, info.name),
        hub_object_id: info.id,
        private: false,
        gated: info.gated,
        likes: finiteCount(info.likes),
        downloads: finiteCount(info.downloads),
        updated_at: info.updatedAt.toISOString(),
        ...(info.author ? { author: info.author } : {}),
        ...(info.createdAt ? { created_at: isoDate(info.createdAt) } : {}),
        ...(typeof info.disabled === "boolean" ? { disabled: info.disabled } : {}),
        ...(info.sha ? { revision: info.sha } : {}),
        ...(info.task ? { task: info.task } : {}),
        ...(info.library_name ? { library: info.library_name } : {}),
        ...(info.safetensors?.total !== undefined
          ? { safetensors_total_parameters: finiteCount(info.safetensors.total) }
          : {}),
        ...(tags.values.length > 0 ? { tags: tags.values } : {}),
        ...(tags.truncated ? { arrays_truncated: true } : {}),
      };
      break;
    }
    case "dataset": {
      const info = await datasetInfo({
        ...common,
        additionalFields: [
          "author",
          "createdAt",
          "disabled",
          "sha",
          "tags",
        ],
      });
      rejectPrivate(info.private);
      const tags = boundedStrings(info.tags);
      resource = {
        resource_type: kind,
        repo_id: info.name,
        canonical_url: resourceUrl(kind, info.name),
        hub_object_id: info.id,
        private: false,
        gated: info.gated,
        likes: finiteCount(info.likes),
        downloads: finiteCount(info.downloads),
        updated_at: info.updatedAt.toISOString(),
        ...(info.author ? { author: info.author } : {}),
        ...(info.createdAt ? { created_at: isoDate(info.createdAt) } : {}),
        ...(typeof info.disabled === "boolean" ? { disabled: info.disabled } : {}),
        ...(info.sha ? { revision: info.sha } : {}),
        ...(tags.values.length > 0 ? { tags: tags.values } : {}),
        ...(tags.truncated ? { arrays_truncated: true } : {}),
      };
      break;
    }
    case "space": {
      const info = await spaceInfo({
        ...common,
        additionalFields: [
          "author",
          "createdAt",
          "datasets",
          "disabled",
          "models",
          "runtime",
          "sha",
          "tags",
        ],
      });
      rejectPrivate(info.private);
      const tags = boundedStrings(info.tags);
      const models = boundedStrings(info.models);
      const datasets = boundedStrings(info.datasets);
      const arraysTruncated = tags.truncated || models.truncated || datasets.truncated;
      resource = {
        resource_type: kind,
        repo_id: info.name,
        canonical_url: resourceUrl(kind, info.name),
        hub_object_id: info.id,
        private: false,
        likes: finiteCount(info.likes),
        updated_at: info.updatedAt.toISOString(),
        ...(info.author ? { author: info.author } : {}),
        ...(info.createdAt ? { created_at: isoDate(info.createdAt) } : {}),
        ...(typeof info.disabled === "boolean" ? { disabled: info.disabled } : {}),
        ...(info.sha ? { revision: info.sha } : {}),
        ...(info.sdk ? { sdk: info.sdk } : {}),
        ...(info.runtime?.stage ? { runtime_stage: info.runtime.stage } : {}),
        ...(info.runtime?.hardware
          ? {
              hardware_current: info.runtime.hardware.current,
              hardware_requested: info.runtime.hardware.requested,
            }
          : {}),
        ...(tags.values.length > 0 ? { tags: tags.values } : {}),
        ...(models.values.length > 0 ? { linked_models: models.values } : {}),
        ...(datasets.values.length > 0 ? { linked_datasets: datasets.values } : {}),
        ...(arraysTruncated ? { arrays_truncated: true } : {}),
      };
      break;
    }
  }

  return {
    protocol: "hf-kingdom-resource/v1",
    resource,
    observation_boundary: {
      access: "public-read-without-token",
      transport: "@huggingface/hub",
      assertions_are_untrusted: true,
      private_resources_in_scope: false,
      hub_mutation_in_scope: false,
    },
  };
}

/**
 * Validate and reconstruct one public dataset observation for a pinned local
 * integration. The returned object contains only the dataset fields produced
 * by observePublicResource; unknown fields, hidden properties, symbols, and
 * custom tag-array properties fail closed before anything reaches a store.
 */
export function normalizePublicDatasetSnapshot(
  value: unknown,
  expected: PublicDatasetSnapshotIdentity,
): HubResourceSnapshot {
  const outer = snapshotObject(value, `${expected.observer_label} snapshot`);
  exactSnapshotKeys(outer, [
    "protocol",
    "resource",
    "observation_boundary",
  ], `${expected.observer_label} snapshot`);
  const resource = snapshotObject(
    outer.resource,
    `${expected.observer_label} snapshot.resource`,
  );
  const resourceLabel = `${expected.observer_label} snapshot.resource`;
  allowedSnapshotKeys(resource, [
    "resource_type",
    "repo_id",
    "canonical_url",
    "hub_object_id",
    "private",
    "likes",
    "updated_at",
    "author",
    "created_at",
    "disabled",
    "revision",
    "tags",
    "gated",
    "downloads",
    "arrays_truncated",
  ], resourceLabel);
  requiredSnapshotKeys(resource, [
    "resource_type",
    "repo_id",
    "canonical_url",
    "hub_object_id",
    "private",
    "likes",
    "updated_at",
  ], resourceLabel);
  const boundary = snapshotObject(
    outer.observation_boundary,
    `${expected.observer_label} snapshot.observation_boundary`,
  );
  exactSnapshotKeys(boundary, [
    "access",
    "transport",
    "assertions_are_untrusted",
    "private_resources_in_scope",
    "hub_mutation_in_scope",
  ], `${expected.observer_label} snapshot.observation_boundary`);

  if (
    outer.protocol !== "hf-kingdom-resource/v1"
    || resource.resource_type !== "dataset"
    || resource.repo_id !== expected.repo_id
    || resource.canonical_url !== expected.canonical_url
    || resource.hub_object_id !== expected.hub_object_id
  ) {
    throw new Error(`${expected.observer_label} observer returned a different resource identity`);
  }
  if (resource.private !== false) {
    throw new Error(`${expected.observer_label} observer returned a private resource`);
  }
  if (
    boundary.access !== "public-read-without-token"
    || boundary.transport !== "@huggingface/hub"
    || boundary.assertions_are_untrusted !== true
    || boundary.private_resources_in_scope !== false
    || boundary.hub_mutation_in_scope !== false
  ) {
    throw new Error(`${expected.observer_label} observer returned an unsafe observation boundary`);
  }

  const likes = snapshotNonnegativeInteger(resource.likes, "observed resource likes");
  const downloads = resource.downloads === undefined
    ? undefined
    : snapshotNonnegativeInteger(resource.downloads, "observed resource downloads");
  const updatedAt = snapshotIsoInstant(resource.updated_at, "observed resource updated_at");
  const author = resource.author === undefined
    ? undefined
    : boundedSnapshotString(
      resource.author,
      "observed resource author",
      MAX_PUBLIC_DATASET_AUTHOR_LENGTH,
    );
  const createdAt = resource.created_at === undefined
    ? undefined
    : snapshotIsoInstant(resource.created_at, "observed resource created_at");
  const disabled = resource.disabled;
  if (disabled !== undefined && typeof disabled !== "boolean") {
    throw new Error(`${expected.observer_label} observer returned an invalid disabled state`);
  }
  const revision = resource.revision;
  if (
    revision !== undefined
    && (typeof revision !== "string" || !SNAPSHOT_SHA40.test(revision))
  ) {
    throw new Error(`${expected.observer_label} observer returned an invalid revision`);
  }
  const tags = resource.tags === undefined
    ? undefined
    : boundedSnapshotTags(resource.tags);
  const gated = resource.gated;
  if (
    gated !== undefined
    && gated !== false
    && gated !== "auto"
    && gated !== "manual"
  ) {
    throw new Error(`${expected.observer_label} observer returned an invalid gated state`);
  }
  const arraysTruncated = resource.arrays_truncated;
  if (arraysTruncated !== undefined && typeof arraysTruncated !== "boolean") {
    throw new Error(`${expected.observer_label} observer returned an invalid arrays_truncated state`);
  }

  return {
    protocol: "hf-kingdom-resource/v1",
    resource: {
      resource_type: "dataset",
      repo_id: expected.repo_id,
      canonical_url: expected.canonical_url,
      hub_object_id: expected.hub_object_id,
      private: false,
      likes,
      updated_at: updatedAt,
      ...(author === undefined ? {} : { author }),
      ...(createdAt === undefined ? {} : { created_at: createdAt }),
      ...(disabled === undefined ? {} : { disabled }),
      ...(revision === undefined ? {} : { revision }),
      ...(tags === undefined ? {} : { tags }),
      ...(gated === undefined ? {} : { gated }),
      ...(downloads === undefined ? {} : { downloads }),
      ...(arraysTruncated === undefined ? {} : { arrays_truncated: arraysTruncated }),
    },
    observation_boundary: {
      access: "public-read-without-token",
      transport: "@huggingface/hub",
      assertions_are_untrusted: true,
      private_resources_in_scope: false,
      hub_mutation_in_scope: false,
    },
  };
}

function boundedSnapshotTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_ARRAY_ITEMS) {
    throw new TypeError(`observed resource tags must contain 0-${MAX_ARRAY_ITEMS} strings`);
  }
  assertDenseSnapshotArray(value, "observed resource tags");
  const tags = value.map((tag, index) => boundedSnapshotString(
    tag,
    `observed resource tags[${index}]`,
    MAX_PUBLIC_DATASET_TAG_LENGTH,
  ));
  if (new Set(tags).size !== tags.length) {
    throw new TypeError("observed resource tags must not contain duplicates");
  }
  return tags;
}

function boundedSnapshotString(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) {
    throw new TypeError(`${label} must be a bounded non-empty string`);
  }
  return value;
}

function snapshotNonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value as number;
}

function snapshotIsoInstant(value: unknown, label: string): string {
  if (
    typeof value !== "string"
    || !SNAPSHOT_ISO_INSTANT.test(value)
    || Number.isNaN(Date.parse(value))
  ) {
    throw new TypeError(`${label} must be an ISO UTC instant`);
  }
  return value;
}

function snapshotObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactSnapshotKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = snapshotOwnStringKeys(value, label).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])
  ) {
    throw new TypeError(`${label} must contain exactly: ${wanted.join(", ")}`);
  }
}

function allowedSnapshotKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const extras = snapshotOwnStringKeys(value, label).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    throw new TypeError(`${label} contains unexpected fields: ${extras.sort().join(", ")}`);
  }
}

function requiredSnapshotKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  label: string,
): void {
  const actual = new Set(snapshotOwnStringKeys(value, label));
  const missing = required.filter((key) => !actual.has(key));
  if (missing.length > 0) {
    throw new TypeError(`${label} is missing required fields: ${missing.join(", ")}`);
  }
}

function snapshotOwnStringKeys(value: Record<string, unknown>, label: string): string[] {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) {
    throw new TypeError(`${label} contains unexpected symbol fields`);
  }
  return keys as string[];
}

function assertDenseSnapshotArray(value: unknown[], label: string): void {
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

function resourceUrl(kind: ResourceKind, repoId: string): string {
  const prefix = kind === "model" ? "" : `${kind}s/`;
  return `https://huggingface.co/${prefix}${repoId}`;
}

function rejectPrivate(isPrivate: boolean): asserts isPrivate is false {
  if (isPrivate) {
    throw new Error("private Hugging Face resources are outside this lab's collection scope");
  }
}

function finiteCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function isoDate(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Hugging Face returned an invalid date");
  }
  return parsed.toISOString();
}

function boundedStrings(values: string[] | undefined): {
  values: string[];
  truncated: boolean;
} {
  if (!values) return { values: [], truncated: false };
  const normalized = [...new Set(values.filter((value) => typeof value === "string"))]
    .sort((left, right) => left.localeCompare(right));
  return {
    values: normalized.slice(0, MAX_ARRAY_ITEMS),
    truncated: normalized.length > MAX_ARRAY_ITEMS,
  };
}
