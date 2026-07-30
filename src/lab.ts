import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  observePublicResource,
  type HubResourceSnapshot,
  type ResourceKind,
} from "./hub.ts";
import {
  AGGREGATE_COLLECTION,
  collectReceipt,
  collectResource,
  openLabNode,
  RECEIPT_COLLECTION,
  RESOURCE_COLLECTION,
  resolveHits,
  type ResolvedHit,
  type RunReceipt,
} from "./store.ts";

export interface ResourceRequest {
  resource_type: ResourceKind;
  repo_id: string;
}

export interface IngestOptions {
  root: string;
  resources: ResourceRequest[];
  observer?: (kind: ResourceKind, repoId: string) => Promise<HubResourceSnapshot>;
  now?: () => Date;
  runId?: () => string;
}

export interface IngestResult {
  node_id: string;
  resources: RunReceipt["results"];
  receipt_record: {
    id: string;
    content_sha256: string;
  };
}

const MAX_RESOURCES_PER_RUN = 12;
const MAX_QUERY_LENGTH = 200;
const MAX_QUERY_LIMIT = 50;

export const DEFAULT_DATA_ROOT = resolve(import.meta.dir, "..", ".hf-kingdom-data");

export const DEMO_RESOURCES: ResourceRequest[] = [
  {
    resource_type: "dataset",
    repo_id: "AI-Secure/DTap-Bench-Agent-Trajectories",
  },
  {
    resource_type: "dataset",
    repo_id: "MCPShield/mcp-security-scan-2026",
  },
  {
    resource_type: "model",
    repo_id: "mlx-community/gpt-oss-20b-MXFP4-Q8",
  },
  {
    resource_type: "space",
    repo_id: "Agents-MCP-Hackathon/Graphify",
  },
];

export async function ingestResources(options: IngestOptions): Promise<IngestResult> {
  if (options.resources.length === 0 || options.resources.length > MAX_RESOURCES_PER_RUN) {
    throw new TypeError(`ingest requires 1-${MAX_RESOURCES_PER_RUN} resources`);
  }
  const now = options.now ?? (() => new Date());
  const runId = options.runId ?? randomUUID;
  const observer = options.observer ?? observePublicResource;
  const observedAt = now().toISOString();
  const node = await openLabNode(options.root);

  try {
    const results: RunReceipt["results"] = [];
    const remoteReads: string[] = [];
    for (const request of options.resources) {
      const snapshot = await observer(request.resource_type, request.repo_id);
      const collected = await collectResource(node, snapshot, observedAt);
      remoteReads.push(snapshot.resource.canonical_url);
      results.push({
        resource_type: request.resource_type,
        repo_id: request.repo_id,
        record_id: collected.record.id,
        content_sha256: collected.record.content.sha256,
        disposition: collected.disposition,
      });
    }

    const receipt: RunReceipt = {
      protocol: "hf-kingdom-run-receipt/v1",
      run_id: runId(),
      observed_at: observedAt,
      operation: "ingest",
      inputs: {
        resources: options.resources.map((resource) => ({ ...resource })),
      },
      effects: {
        remote_reads: remoteReads,
        local_writes: [
          "AgentTool agent-data/v1 SQLite metadata/index",
          "AgentTool content-addressed local blobs",
        ],
        remote_writes: [],
        inference_requests: [],
        jobs_submitted: [],
      },
      results,
      limits: [
        "Only explicitly named public model, dataset, and Space metadata was requested",
        "No access token was supplied to @huggingface/hub",
        "Hub assertions were stored as untrusted evidence",
        "No dataset rows, repository files, model weights, or Space inputs were collected",
        "AgentTool memory projection and peer sync were not performed",
      ],
    };
    const receiptRecord = await collectReceipt(node, receipt);

    return {
      node_id: node.node_id,
      resources: results,
      receipt_record: {
        id: receiptRecord.id,
        content_sha256: receiptRecord.content.sha256,
      },
    };
  } finally {
    node.close();
  }
}

export async function queryLab(
  root: string,
  text: string,
  limit = 20,
): Promise<{ consistency: "local"; hits: ResolvedHit[] }> {
  if (text.length === 0 || text.length > MAX_QUERY_LENGTH) {
    throw new TypeError(`query text must be 1-${MAX_QUERY_LENGTH} characters`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_QUERY_LIMIT) {
    throw new TypeError(`query limit must be an integer from 1-${MAX_QUERY_LIMIT}`);
  }
  const node = await openLabNode(root);
  try {
    const response = node.query({
      collections: [RESOURCE_COLLECTION, RECEIPT_COLLECTION, AGGREGATE_COLLECTION],
      text,
      limit,
      consistency: "local",
    });
    return {
      consistency: response.consistency,
      hits: await resolveHits(node, response.records),
    };
  } finally {
    node.close();
  }
}

export async function inspectLab(root: string): Promise<unknown> {
  const node = await openLabNode(root);
  try {
    const manifest = node.manifest();
    return {
      data_root: resolve(root),
      node_id: manifest.node_id,
      protocol: manifest.protocol,
      collections: node.listCollections(),
      capabilities: manifest.capabilities,
      boundary: {
        server_started: false,
        peer_sync: false,
        memory_projection: false,
        hub_token_used: false,
      },
    };
  } finally {
    node.close();
  }
}
