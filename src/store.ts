import {
  canonicalJson,
  DataNode,
  type JsonObject,
  type QueryHit,
  type RecordEnvelope,
} from "@agenttool/data";
import type { HubResourceSnapshot } from "./hub.ts";

export const RESOURCE_COLLECTION = "hf-resources-v1";
export const RECEIPT_COLLECTION = "hf-run-receipts-v1";
export const AGGREGATE_COLLECTION = "hf-dataset-aggregates-v1";
export const DTAP_COLLECTION = "hf-dtap-path-censuses-v1";
export const GRAPH_COLLECTION = "hf-resource-graphs-v1";
export const EMBEDDING_COLLECTION = "hf-embedding-prepare-receipts-v1";
export const SEMANTIC_COLLECTION = "hf-semantic-vectors-v1";
export const TRACKIO_COLLECTION = "hf-trackio-mappings-v1";

export type LabCollectionId =
  | typeof RESOURCE_COLLECTION
  | typeof RECEIPT_COLLECTION
  | typeof AGGREGATE_COLLECTION
  | typeof DTAP_COLLECTION
  | typeof GRAPH_COLLECTION
  | typeof EMBEDDING_COLLECTION
  | typeof SEMANTIC_COLLECTION
  | typeof TRACKIO_COLLECTION;

export interface RunReceipt {
  protocol: "hf-kingdom-run-receipt/v1";
  run_id: string;
  observed_at: string;
  operation: "ingest";
  inputs: {
    resources: Array<{ resource_type: string; repo_id: string }>;
  };
  effects: {
    remote_reads: string[];
    local_writes: string[];
    remote_writes: [];
    inference_requests: [];
    jobs_submitted: [];
  };
  results: Array<{
    resource_type: string;
    repo_id: string;
    record_id: string;
    content_sha256: string;
    disposition: "inserted" | "existing";
  }>;
  limits: string[];
}

export interface ResolvedHit {
  record: RecordEnvelope;
  score?: number;
  document: unknown;
}

export async function openLabNode(root: string): Promise<DataNode> {
  return DataNode.open({
    root,
    collections: [
      {
        id: RESOURCE_COLLECTION,
        name: "Hugging Face resource snapshots",
        description: "Immutable normalized observations of explicitly named public Hub resources.",
        schema: { version: "hf-kingdom-resource/v1" },
        policy: {
          visibility: "private",
          max_record_bytes: 256_000,
          allowed_media_types: ["application/json"],
        },
      },
      {
        id: RECEIPT_COLLECTION,
        name: "Hugging Face lab run receipts",
        description: "Immutable receipts for bounded lab runs and their observed effects.",
        schema: { version: "hf-kingdom-run-receipt/v1" },
        policy: {
          visibility: "private",
          max_record_bytes: 256_000,
          allowed_media_types: ["application/json"],
        },
      },
      {
        id: AGGREGATE_COLLECTION,
        name: "Hugging Face dataset aggregates",
        description: "Bounded aggregate-only query results over exact public dataset bytes.",
        schema: { version: "hf-kingdom-dataset-aggregate/v1" },
        policy: {
          visibility: "private",
          max_record_bytes: 256_000,
          allowed_media_types: ["application/json"],
        },
      },
      {
        id: DTAP_COLLECTION,
        name: "Bounded DTap path censuses",
        description: "Aggregate-only repository-tree observations for the fixed public DTap dataset.",
        schema: { version: "hf-kingdom-dtap-path-census/v1" },
        policy: {
          visibility: "private",
          max_record_bytes: 256_000,
          allowed_media_types: ["application/json"],
        },
      },
      {
        id: GRAPH_COLLECTION,
        name: "Bounded Hugging Face resource graphs",
        description: "Exact-root public Collection and Paper observations plus explicit local curation edges.",
        schema: { version: "hf-kingdom-resource-graph/v1" },
        policy: {
          visibility: "private",
          max_record_bytes: 256_000,
          allowed_media_types: ["application/json"],
        },
      },
      {
        id: EMBEDDING_COLLECTION,
        name: "Embedding asset preparation receipts",
        description: "Receipts for the fixed hash-verified local semantic model assets.",
        schema: { version: "hf-kingdom-embedding-prepare/v1" },
        policy: {
          visibility: "private",
          max_record_bytes: 256_000,
          allowed_media_types: ["application/json"],
        },
      },
      {
        id: SEMANTIC_COLLECTION,
        name: "Local semantic vectors",
        description: "Bounded CPU-derived English semantic signals tied to immutable AgentTool source records.",
        schema: { version: "hf-kingdom-semantic-vector/v1" },
        policy: {
          visibility: "private",
          max_record_bytes: 256_000,
          allowed_media_types: ["application/json"],
        },
      },
      {
        id: TRACKIO_COLLECTION,
        name: "Trackio capability mappings",
        description: "Deterministic mapping-only observability documents; not native Trackio storage.",
        schema: { version: "hf-kingdom-trackio-adapter/v1" },
        policy: {
          visibility: "private",
          max_record_bytes: 256_000,
          allowed_media_types: ["application/json"],
        },
      },
    ],
  });
}

export interface CollectLabJsonInput {
  collection_id: LabCollectionId;
  document: unknown;
  source_uri: string;
  external_id: string;
  key: string;
  version: string;
  observed_at: string;
  metadata: JsonObject;
  provenance: Array<{
    activity: string;
    at: string;
    actor: string;
    input_ids: string[];
  }>;
}

export async function collectLabJson(
  node: DataNode,
  input: CollectLabJsonInput,
): Promise<{ record: RecordEnvelope; disposition: "inserted" | "existing" }> {
  const response = await node.collect({
    collection_id: input.collection_id,
    collector_id: "text",
    input: {
      text: canonicalJson(input.document as JsonObject),
      media_type: "application/json",
      source_uri: input.source_uri,
      external_id: input.external_id,
      key: input.key,
      version: input.version,
      observed_at: input.observed_at,
      metadata: input.metadata,
      provenance: input.provenance,
    } satisfies JsonObject,
  });
  const record = response.records[0];
  if (!record) throw new Error("AgentTool data node returned no JSON record");
  return {
    record,
    disposition: response.inserted === 1 ? "inserted" : "existing",
  };
}

export async function collectResource(
  node: DataNode,
  snapshot: HubResourceSnapshot,
  observedAt: string,
): Promise<{ record: RecordEnvelope; disposition: "inserted" | "existing" }> {
  const resource = snapshot.resource;
  const response = await node.collect({
    collection_id: RESOURCE_COLLECTION,
    collector_id: "text",
    input: {
      text: canonicalJson(snapshot),
      media_type: "application/json",
      source_uri: resource.canonical_url,
      external_id: `${resource.resource_type}:${resource.repo_id}`,
      key: `${resource.resource_type}:${resource.repo_id}`,
      version: resource.revision ?? resource.updated_at,
      observed_at: observedAt,
      metadata: {
        document_type: "hf-resource",
        resource_type: resource.resource_type,
        repo_id: resource.repo_id,
      },
      provenance: [
        {
          activity: "observed",
          at: observedAt,
          actor: "hf-kingdom-lab:@huggingface/hub",
          input_ids: [],
        },
      ],
    } satisfies JsonObject,
  });
  const record = response.records[0];
  if (!record) throw new Error("AgentTool data node returned no resource record");
  return {
    record,
    disposition: response.inserted === 1 ? "inserted" : "existing",
  };
}

export async function collectReceipt(
  node: DataNode,
  receipt: RunReceipt,
): Promise<RecordEnvelope> {
  const response = await node.collect({
    collection_id: RECEIPT_COLLECTION,
    collector_id: "text",
    input: {
      text: canonicalJson(receipt),
      media_type: "application/json",
      source_uri: `urn:hf-kingdom-lab:run:${receipt.run_id}`,
      external_id: receipt.run_id,
      key: receipt.run_id,
      version: "1",
      observed_at: receipt.observed_at,
      metadata: {
        document_type: "run-receipt",
        operation: receipt.operation,
      },
      provenance: [
        {
          activity: "recorded",
          at: receipt.observed_at,
          actor: "hf-kingdom-lab",
          input_ids: receipt.results.map((result) => result.record_id),
        },
      ],
    } satisfies JsonObject,
  });
  const record = response.records[0];
  if (!record) throw new Error("AgentTool data node returned no receipt record");
  return record;
}

export async function resolveHits(
  node: DataNode,
  hits: QueryHit[],
): Promise<ResolvedHit[]> {
  return Promise.all(hits.map(async (hit) => {
    const resolved = await node.resolveRecord(hit.record.id);
    const document = resolved.content.encoding === "utf8"
      ? JSON.parse(resolved.content.data) as unknown
      : { encoding: "base64", data: resolved.content.data };
    return {
      record: hit.record,
      ...(hit.score !== undefined ? { score: hit.score } : {}),
      document,
    };
  }));
}
