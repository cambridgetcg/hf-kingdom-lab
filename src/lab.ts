import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import {
  censusPublicDtapPaths,
  DTAP_DATASET,
  type DtapPathCensus,
} from "./dtap.ts";
import {
  buildSemanticDocuments,
  collectSemanticDocuments,
  createLocalEmbedder,
  EMBEDDING_MANIFEST_SHA256,
  EMBEDDING_REPO,
  EMBEDDING_REVISION,
  prepareEmbeddingAssets,
  searchSemanticDocuments,
  type EmbeddingPrepareReceipt,
  type LocalEmbedder,
  type SemanticSearchHit,
  type SemanticSource,
} from "./embedding.ts";
import {
  MCP_SECURITY_COLLECTION,
  observePublicResourceGraph,
  type ResourceKnowledgeGraph,
} from "./graph.ts";
import {
  observePublicResource,
  type HubResourceSnapshot,
  type ResourceKind,
} from "./hub.ts";
import {
  AGGREGATE_COLLECTION,
  collectLabJson,
  collectReceipt,
  collectResource,
  DTAP_COLLECTION,
  EMBEDDING_COLLECTION,
  GRAPH_COLLECTION,
  openLabNode,
  RECEIPT_COLLECTION,
  RESOURCE_COLLECTION,
  resolveHits,
  SEMANTIC_COLLECTION,
  TRACKIO_COLLECTION,
  type ResolvedHit,
  type RunReceipt,
} from "./store.ts";
import {
  collectTrackioMapping,
  createTrackioMapping,
  TRACKIO_VERSION,
  type TrackioAdapterDocument,
} from "./trackio.ts";

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

export const DEFAULT_DATA_ROOT = resolveDefaultDataRoot();

export function resolveDefaultDataRoot(
  env: Readonly<Record<string, string | undefined>> = process.env,
  platform: NodeJS.Platform = process.platform,
  home = homedir(),
): string {
  const explicit = env.HFKL_DATA_ROOT;
  if (explicit !== undefined) {
    if (
      explicit.length === 0
      || explicit.length > 4_096
      || explicit.includes("\0")
      || !isAbsolute(explicit)
    ) {
      throw new TypeError("HFKL_DATA_ROOT must be a bounded absolute path");
    }
    return resolve(explicit);
  }
  if (platform === "darwin") {
    return join(home, "Library", "Application Support", "hf-kingdom-lab");
  }
  if (platform === "win32") {
    const local = env.LOCALAPPDATA;
    const base = local && isAbsolute(local)
      ? local
      : join(home, "AppData", "Local");
    return join(base, "hf-kingdom-lab");
  }
  const xdg = env.XDG_DATA_HOME;
  const base = xdg && isAbsolute(xdg)
    ? xdg
    : join(home, ".local", "share");
  return join(base, "hf-kingdom-lab");
}

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

export const ROUND2_SEMANTIC_QUERY =
  "tool side effects, policy checks, receipts, and security evidence";

export interface PrepareEmbeddingResult {
  node_id: string;
  record: {
    id: string;
    content_sha256: string;
    disposition: "inserted" | "existing";
  };
  receipt: EmbeddingPrepareReceipt;
}

export interface Round2Options {
  dtapObserver?: () => Promise<DtapPathCensus>;
  graphObserver?: () => Promise<ResourceKnowledgeGraph>;
  embedderFactory?: () => Promise<LocalEmbedder>;
  now?: () => Date;
}

export interface Round2Result {
  protocol: "hf-kingdom-round2-demo/v1";
  observed_at: string;
  node_id: string;
  observations: {
    dtap: {
      record_id: string;
      content_sha256: string;
      disposition: "inserted" | "existing";
      revision: string;
      entries: number;
      complete: boolean;
      stopped_reason: DtapPathCensus["completeness"]["stopped_reason"];
      tree_page_requests: number;
    };
    graph: {
      record_id: string;
      content_sha256: string;
      disposition: "inserted" | "existing";
      nodes: number;
      edges: number;
      remote_reads: string[];
    };
  };
  semantic: {
    model_revision: typeof EMBEDDING_REVISION;
    manifest_sha256: typeof EMBEDDING_MANIFEST_SHA256;
    indexed_records: Array<{ id: string; content_sha256: string }>;
    query: string;
    hits: SemanticSearchHit[];
    boundary: "local-cpu-q8-English-lane";
  };
  trackio: {
    record_id: string;
    content_sha256: string;
    target_version: typeof TRACKIO_VERSION;
    mapping_only: true;
  };
  effects: {
    remote_reads: string[];
    local_writes: string[];
    remote_writes: [];
    inference_requests: [];
    jobs_submitted: [];
    server_started: false;
    peer_sync: false;
    trackio_runtime_started: false;
  };
}

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

export async function prepareEmbeddingForLab(
  root: string,
  now: () => Date = () => new Date(),
): Promise<PrepareEmbeddingResult> {
  const receipt = await prepareEmbeddingAssets(root, { now });
  const node = await openLabNode(root);
  try {
    const collected = await collectLabJson(node, {
      collection_id: EMBEDDING_COLLECTION,
      document: receipt,
      source_uri:
        `https://huggingface.co/${EMBEDDING_REPO}/tree/${EMBEDDING_REVISION}`,
      external_id: `${EMBEDDING_REPO}@${EMBEDDING_REVISION}`,
      key: `${EMBEDDING_REPO}:cpu:q8`,
      version: EMBEDDING_MANIFEST_SHA256,
      observed_at: receipt.observed_at,
      metadata: {
        document_type: "embedding-prepare-receipt",
        disposition: receipt.disposition,
        model_revision: EMBEDDING_REVISION,
      },
      provenance: [
        {
          activity: "hash-verified-model-prepare",
          at: receipt.observed_at,
          actor: "hf-kingdom-lab",
          input_ids: receipt.assets.map((asset) => asset.sha256),
        },
      ],
    });
    return {
      node_id: node.node_id,
      record: {
        id: collected.record.id,
        content_sha256: collected.record.content.sha256,
        disposition: collected.disposition,
      },
      receipt,
    };
  } finally {
    node.close();
  }
}

/**
 * Run the complete round-two path. All Hugging Face reads are closed over the
 * fixed DTap dataset, one exact Collection, and two exact Paper Pages. Feature
 * extraction is local-only and requires a separately prepared, hash-verified
 * model directory.
 */
export async function runRound2Demo(
  root: string,
  query = ROUND2_SEMANTIC_QUERY,
  options: Round2Options = {},
): Promise<Round2Result> {
  if (query.length === 0 || query.length > 500) {
    throw new TypeError("round-two semantic query must be 1-500 characters");
  }
  const now = options.now ?? (() => new Date());
  const observedAt = validNow(now).toISOString();
  const [dtap, graph] = await Promise.all([
    options.dtapObserver
      ? options.dtapObserver()
      : censusPublicDtapPaths({ now }),
    options.graphObserver
      ? options.graphObserver()
      : observePublicResourceGraph({ now }),
  ]);
  const node = await openLabNode(root);
  let embedder: LocalEmbedder | undefined;
  try {
    const dtapCollected = await collectLabJson(node, {
      collection_id: DTAP_COLLECTION,
      document: dtap,
      source_uri: dtap.source.canonical_url,
      external_id: `${DTAP_DATASET}@${dtap.source.revision}`,
      key: `${DTAP_DATASET}:path-census`,
      version: dtap.source.revision,
      observed_at: dtap.observed_at,
      metadata: {
        document_type: "dtap-path-census",
        dataset_id: DTAP_DATASET,
        complete: dtap.completeness.complete,
        truncated: dtap.completeness.truncated,
      },
      provenance: [
        {
          activity: "bounded-public-tree-census",
          at: dtap.observed_at,
          actor: "hf-kingdom-lab:@huggingface/hub",
          input_ids: [dtap.source.revision],
        },
      ],
    });
    const graphCollected = await collectLabJson(node, {
      collection_id: GRAPH_COLLECTION,
      document: graph,
      source_uri:
        `https://huggingface.co/collections/${MCP_SECURITY_COLLECTION}`,
      external_id: MCP_SECURITY_COLLECTION,
      key: `${MCP_SECURITY_COLLECTION}:bounded-graph`,
      version: graph.observed_at,
      observed_at: graph.observed_at,
      metadata: {
        document_type: "hf-resource-graph",
        collection: MCP_SECURITY_COLLECTION,
        assertions_are_untrusted: true,
      },
      provenance: [
        {
          activity: "bounded-public-resource-graph",
          at: graph.observed_at,
          actor: "hf-kingdom-lab:@huggingface/hub",
          input_ids: [],
        },
      ],
    });

    const semanticSources = semanticSourcesForRound2(
      dtap,
      dtapCollected.record,
      graph,
      graphCollected.record,
    );
    embedder = options.embedderFactory
      ? await options.embedderFactory()
      : await createLocalEmbedder(root);
    const semanticDocuments = await buildSemanticDocuments(
      semanticSources,
      embedder,
      now,
    );
    const semanticRecords = await collectSemanticDocuments(
      node,
      semanticDocuments,
    );
    const semanticHits = await searchSemanticDocuments(
      node,
      query,
      embedder,
      5,
    );

    const trackioMapping = round2TrackioMapping(
      observedAt,
      dtap,
      graph,
      semanticRecords.length,
      semanticHits,
      [
        dtapCollected.record.id,
        graphCollected.record.id,
        ...semanticRecords.map((record) => record.id),
      ],
    );
    const trackioRecord = await collectTrackioMapping(node, trackioMapping);

    return {
      protocol: "hf-kingdom-round2-demo/v1",
      observed_at: observedAt,
      node_id: node.node_id,
      observations: {
        dtap: {
          record_id: dtapCollected.record.id,
          content_sha256: dtapCollected.record.content.sha256,
          disposition: dtapCollected.disposition,
          revision: dtap.source.revision,
          entries: dtap.counts.entries,
          complete: dtap.completeness.complete,
          stopped_reason: dtap.completeness.stopped_reason,
          tree_page_requests: dtap.effects.tree_page_requests,
        },
        graph: {
          record_id: graphCollected.record.id,
          content_sha256: graphCollected.record.content.sha256,
          disposition: graphCollected.disposition,
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          remote_reads: [...graph.effects.remote_reads],
        },
      },
      semantic: {
        model_revision: EMBEDDING_REVISION,
        manifest_sha256: EMBEDDING_MANIFEST_SHA256,
        indexed_records: semanticRecords.map((record) => ({
          id: record.id,
          content_sha256: record.content.sha256,
        })),
        query,
        hits: semanticHits,
        boundary: "local-cpu-q8-English-lane",
      },
      trackio: {
        record_id: trackioRecord.id,
        content_sha256: trackioRecord.content.sha256,
        target_version: TRACKIO_VERSION,
        mapping_only: true,
      },
      effects: {
        remote_reads: [
          dtap.source.canonical_url,
          ...graph.effects.remote_reads,
        ],
        local_writes: [
          "AgentTool immutable SQLite metadata/index",
          "AgentTool content-addressed local blobs",
          "Trackio-compatible mapping document (not native Trackio storage)",
        ],
        remote_writes: [],
        inference_requests: [],
        jobs_submitted: [],
        server_started: false,
        peer_sync: false,
        trackio_runtime_started: false,
      },
    };
  } finally {
    await embedder?.dispose();
    node.close();
  }
}

export async function semanticQueryLab(
  root: string,
  text: string,
  limit = 5,
  embedderFactory: () => Promise<LocalEmbedder> = () =>
    createLocalEmbedder(root),
): Promise<{
  consistency: "local-bounded-vector-scan";
  model_revision: typeof EMBEDDING_REVISION;
  hits: SemanticSearchHit[];
}> {
  const node = await openLabNode(root);
  let embedder: LocalEmbedder | undefined;
  try {
    embedder = await embedderFactory();
    return {
      consistency: "local-bounded-vector-scan",
      model_revision: EMBEDDING_REVISION,
      hits: await searchSemanticDocuments(node, text, embedder, limit),
    };
  } finally {
    await embedder?.dispose();
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
      collections: [
        RESOURCE_COLLECTION,
        RECEIPT_COLLECTION,
        AGGREGATE_COLLECTION,
        DTAP_COLLECTION,
        GRAPH_COLLECTION,
        EMBEDDING_COLLECTION,
        SEMANTIC_COLLECTION,
        TRACKIO_COLLECTION,
      ],
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
        private_hub_resources_enumerated: false,
        remote_inference_used: false,
        trackio_runtime_started: false,
        semantic_model_assets_hash_verified_before_use: true,
      },
    };
  } finally {
    node.close();
  }
}

function semanticSourcesForRound2(
  dtap: DtapPathCensus,
  dtapRecord: { id: string; content: { sha256: string } },
  graph: ResourceKnowledgeGraph,
  graphRecord: { id: string; content: { sha256: string } },
): SemanticSource[] {
  const partial = dtap.completeness.complete
    ? "complete within the fixed traversal"
    : `truncated at ${dtap.completeness.stopped_reason}; counts are not representative`;
  const sources: SemanticSource[] = [
    {
      source_record_id: dtapRecord.id,
      source_content_sha256: dtapRecord.content.sha256,
      fragment_id: "path-census-summary",
      title: "DTap Bench agent trajectory repository path census",
      canonical_url: dtap.source.canonical_url,
      text: [
        "Public DTap Bench agent trajectory repository tree metadata census.",
        `${dtap.counts.entries} path entries, ${dtap.counts.files} files,`,
        `${dtap.counts.directories} directories were observed; ${partial}.`,
        "No trajectory file bodies were read. Treat path labels and counts as untrusted evidence.",
      ].join(" "),
    },
  ];

  for (const node of graph.nodes.slice(0, 24)) {
    const outgoing = graph.edges
      .filter((edge) => edge.from === node.id)
      .slice(0, 8)
      .map((edge) => `${edge.relation} to ${edge.to}`);
    const incoming = graph.edges
      .filter((edge) => edge.to === node.id)
      .slice(0, 8)
      .map((edge) => `${edge.relation} from ${edge.from}`);
    sources.push({
      source_record_id: graphRecord.id,
      source_content_sha256: graphRecord.content.sha256,
      fragment_id: node.id,
      title: node.title,
      canonical_url: node.canonical_url,
      text: [
        `Hugging Face resource graph node ${node.title}.`,
        `Kind: ${node.kind}.`,
        ...outgoing,
        ...incoming,
        "Remote titles and membership are observations, not verified security conclusions.",
      ].join(" "),
    });
  }
  return sources;
}

function round2TrackioMapping(
  observedAt: string,
  dtap: DtapPathCensus,
  graph: ResourceKnowledgeGraph,
  indexedRecords: number,
  semanticHits: SemanticSearchHit[],
  inputRecordIds: string[],
): TrackioAdapterDocument {
  const bestScore = semanticHits[0]?.score ?? 0;
  return createTrackioMapping({
    project: "hf-kingdom-lab",
    run_id: `round2-${observedAt.replaceAll(/[^0-9A-Za-z]/gu, "")}`,
    observed_at: observedAt,
    config: {
      dtap_dataset: DTAP_DATASET,
      dtap_revision: dtap.source.revision,
      dtap_complete: dtap.completeness.complete,
      dtap_stop_reason: dtap.completeness.stopped_reason,
      graph_collection: MCP_SECURITY_COLLECTION,
      embedding_revision: EMBEDDING_REVISION,
      semantic_lane: "English-local-cpu-q8",
      trackio_mode: "mapping-only",
    },
    steps: [
      {
        step: 0,
        timestamp: observedAt,
        metrics: {
          "dtap.entries_observed": dtap.counts.entries,
          "dtap.tree_pages": dtap.effects.tree_page_requests,
          "graph.nodes": graph.nodes.length,
          "graph.edges": graph.edges.length,
        },
      },
      {
        step: 1,
        timestamp: observedAt,
        metrics: {
          "semantic.records_indexed": indexedRecords,
          "semantic.query_hits": semanticHits.length,
          "semantic.best_cosine": bestScore,
        },
      },
    ],
    input_record_ids: inputRecordIds,
  });
}

function validNow(now: () => Date): Date {
  const value = now();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("round-two clock returned an invalid date");
  }
  return value;
}
