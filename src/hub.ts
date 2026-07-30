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

export interface ObserveOptions {
  fetch?: typeof fetch;
}

const MAX_REPO_ID_LENGTH = 160;
const MAX_ARRAY_ITEMS = 100;
const REPO_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/;

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
