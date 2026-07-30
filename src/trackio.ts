import {
  canonicalJson,
  type DataNode,
  type JsonObject,
  type JsonPrimitive,
  type RecordEnvelope,
} from "@agenttool/data";
import { TRACKIO_COLLECTION } from "./store.ts";

export const TRACKIO_VERSION = "0.34.0";
export const TRACKIO_COMMIT = "972c8c0";
export const TRACKIO_SOURCE_URL =
  "https://github.com/gradio-app/trackio/tree/972c8c0";
export const TRACKIO_DOCS_URL = "https://huggingface.co/docs/trackio/index";
export const TRACKIO_MAX_STEPS = 128;
export const TRACKIO_MAX_METRICS_PER_STEP = 32;
export const TRACKIO_MAX_CONFIG_FIELDS = 32;

export interface TrackioMetricStep {
  step: number;
  timestamp: string;
  metrics: Record<string, number>;
}

export interface TrackioMappingInput {
  project: string;
  run_id: string;
  observed_at: string;
  config: Record<string, JsonPrimitive>;
  steps: TrackioMetricStep[];
  input_record_ids: string[];
}

export interface TrackioAdapterDocument {
  protocol: "hf-kingdom-trackio-adapter/v1";
  observed_at: string;
  target: {
    package: "trackio";
    version: typeof TRACKIO_VERSION;
    source_commit: typeof TRACKIO_COMMIT;
    source_url: typeof TRACKIO_SOURCE_URL;
    docs_url: typeof TRACKIO_DOCS_URL;
    capability_contract: [
      "run-config",
      "step-indexed-numeric-metrics",
      "explicit-step-and-timestamp",
    ];
  };
  mapping: {
    project: string;
    run_id: string;
    config: Record<string, JsonPrimitive>;
    metrics: TrackioMetricStep[];
  };
  provenance: {
    input_record_ids: string[];
    classification: "local_observability_mapping";
  };
  effects: {
    mapping_only: true;
    trackio_imported: false;
    trackio_runtime_started: false;
    native_sqlite_or_parquet_written: false;
    hardware_logging_started: false;
    dashboard_started: false;
    mcp_server_started: false;
    huggingface_sync_started: false;
    remote_reads: [];
    remote_writes: [];
  };
  limits: {
    max_steps: typeof TRACKIO_MAX_STEPS;
    max_metrics_per_step: typeof TRACKIO_MAX_METRICS_PER_STEP;
    max_config_fields: typeof TRACKIO_MAX_CONFIG_FIELDS;
    schema_target_not_latest_alias: true;
    native_compatibility_not_claimed: true;
  };
}

/**
 * Map bounded AgentTool observations into Trackio's public run/config/metric
 * concepts. This is deliberately not a native Trackio database writer and it
 * does not import or start Trackio.
 */
export function createTrackioMapping(
  input: TrackioMappingInput,
): TrackioAdapterDocument {
  const observedAt = exactIso(input.observed_at, "observed_at");
  const project = identifier(input.project, "project");
  const runId = identifier(input.run_id, "run_id");
  const configEntries = Object.entries(input.config);
  if (configEntries.length > TRACKIO_MAX_CONFIG_FIELDS) {
    throw new TypeError("Trackio mapping config exceeds its field limit");
  }
  const config: Record<string, JsonPrimitive> = {};
  for (const [key, value] of configEntries.sort(([left], [right]) =>
    compare(left, right)
  )) {
    const safeKey = metricKey(key, "config key");
    if (
      value !== null
      && typeof value !== "string"
      && typeof value !== "number"
      && typeof value !== "boolean"
    ) {
      throw new TypeError("Trackio mapping config values must be JSON primitives");
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("Trackio mapping config contains a non-finite number");
    }
    if (typeof value === "string" && value.length > 512) {
      throw new TypeError("Trackio mapping config string exceeds its limit");
    }
    if (
      typeof value === "string"
      && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    ) {
      throw new TypeError("Trackio mapping config string contains controls");
    }
    config[safeKey] = value;
  }

  if (input.steps.length === 0 || input.steps.length > TRACKIO_MAX_STEPS) {
    throw new TypeError(`Trackio mapping requires 1-${TRACKIO_MAX_STEPS} steps`);
  }
  const seenSteps = new Set<number>();
  const steps = input.steps.map((row) => {
    if (!Number.isSafeInteger(row.step) || row.step < 0) {
      throw new TypeError("Trackio mapping step must be a non-negative safe integer");
    }
    if (seenSteps.has(row.step)) {
      throw new TypeError("Trackio mapping steps must be unique");
    }
    seenSteps.add(row.step);
    const entries = Object.entries(row.metrics);
    if (
      entries.length === 0
      || entries.length > TRACKIO_MAX_METRICS_PER_STEP
    ) {
      throw new TypeError("Trackio mapping metric count is outside its limit");
    }
    const metrics: Record<string, number> = {};
    for (const [key, value] of entries.sort(([left], [right]) =>
      compare(left, right)
    )) {
      if (!Number.isFinite(value)) {
        throw new TypeError("Trackio mapping metrics must be finite numbers");
      }
      metrics[metricKey(key, "metric key")] = value;
    }
    return {
      step: row.step,
      timestamp: exactIso(row.timestamp, "metric timestamp"),
      metrics,
    };
  }).sort((left, right) => left.step - right.step);

  const inputRecordIds = [...new Set(input.input_record_ids)].sort(compare);
  if (
    inputRecordIds.length === 0
    || inputRecordIds.length > 64
    || !inputRecordIds.every((id) => bounded(id, 1, 200))
  ) {
    throw new TypeError("Trackio mapping provenance is empty or over-limit");
  }

  return {
    protocol: "hf-kingdom-trackio-adapter/v1",
    observed_at: observedAt,
    target: {
      package: "trackio",
      version: TRACKIO_VERSION,
      source_commit: TRACKIO_COMMIT,
      source_url: TRACKIO_SOURCE_URL,
      docs_url: TRACKIO_DOCS_URL,
      capability_contract: [
        "run-config",
        "step-indexed-numeric-metrics",
        "explicit-step-and-timestamp",
      ],
    },
    mapping: {
      project,
      run_id: runId,
      config,
      metrics: steps,
    },
    provenance: {
      input_record_ids: inputRecordIds,
      classification: "local_observability_mapping",
    },
    effects: {
      mapping_only: true,
      trackio_imported: false,
      trackio_runtime_started: false,
      native_sqlite_or_parquet_written: false,
      hardware_logging_started: false,
      dashboard_started: false,
      mcp_server_started: false,
      huggingface_sync_started: false,
      remote_reads: [],
      remote_writes: [],
    },
    limits: {
      max_steps: TRACKIO_MAX_STEPS,
      max_metrics_per_step: TRACKIO_MAX_METRICS_PER_STEP,
      max_config_fields: TRACKIO_MAX_CONFIG_FIELDS,
      schema_target_not_latest_alias: true,
      native_compatibility_not_claimed: true,
    },
  };
}

export async function collectTrackioMapping(
  node: DataNode,
  mapping: TrackioAdapterDocument,
): Promise<RecordEnvelope> {
  const validated = validateTrackioMapping(mapping);
  const response = await node.collect({
    collection_id: TRACKIO_COLLECTION,
    collector_id: "text",
    input: {
      text: canonicalJson(validated),
      media_type: "application/json",
      source_uri: `urn:hf-kingdom-lab:trackio:${validated.mapping.run_id}`,
      external_id: validated.mapping.run_id,
      key: validated.mapping.run_id,
      version: `${TRACKIO_VERSION}:${validated.observed_at}`,
      observed_at: validated.observed_at,
      metadata: {
        document_type: "trackio-adapter",
        mapping_only: true,
        target_version: TRACKIO_VERSION,
      },
      provenance: [
        {
          activity: "mapped-for-local-observability",
          at: validated.observed_at,
          actor: "hf-kingdom-lab",
          input_ids: validated.provenance.input_record_ids,
        },
      ],
    } satisfies JsonObject,
  });
  const record = response.records[0];
  if (!record) throw new Error("AgentTool data node returned no Trackio mapping record");
  return record;
}

export function validateTrackioMapping(
  value: TrackioAdapterDocument,
): TrackioAdapterDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Trackio mapping is not an object");
  }
  const rebuilt = createTrackioMapping({
    project: value.mapping?.project,
    run_id: value.mapping?.run_id,
    observed_at: value.observed_at,
    config: value.mapping?.config,
    steps: value.mapping?.metrics,
    input_record_ids: value.provenance?.input_record_ids,
  });
  if (
    canonicalJson(value as unknown as JsonObject)
      !== canonicalJson(rebuilt as unknown as JsonObject)
  ) {
    throw new TypeError("Trackio mapping fields do not match the closed schema");
  }
  return rebuilt;
}

function identifier(value: unknown, label: string): string {
  if (
    typeof value !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(value)
  ) {
    throw new TypeError(`Trackio mapping ${label} is invalid`);
  }
  return value;
}

function metricKey(value: unknown, label: string): string {
  if (
    typeof value !== "string"
    || !/^[A-Za-z][A-Za-z0-9_.\/-]{0,99}$/u.test(value)
  ) {
    throw new TypeError(`Trackio mapping ${label} is invalid`);
  }
  return value;
}

function exactIso(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Trackio mapping ${label} is invalid`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(`Trackio mapping ${label} must be an exact ISO timestamp`);
  }
  return value;
}

function bounded(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
