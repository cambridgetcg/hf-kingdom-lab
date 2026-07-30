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
    ],
  });
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
