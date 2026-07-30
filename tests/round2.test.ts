import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DTAP_DATASET,
  DTAP_MAX_ENTRIES,
  DTAP_MAX_METADATA_RESPONSE_BYTES,
  DTAP_MAX_OUTPUT_BUCKETS,
  DTAP_MAX_PATH_BYTES,
  DTAP_MAX_PATH_DEPTH,
  DTAP_MAX_TOTAL_PATH_BYTES,
  DTAP_MAX_TREE_PAGES,
  DTAP_MAX_TREE_RESPONSE_BYTES,
  type DtapPathCensus,
} from "../src/dtap.ts";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_PROFILE,
  type LocalEmbedder,
} from "../src/embedding.ts";
import {
  GRAPH_MAX_COLLECTION_ITEMS,
  GRAPH_MAX_EDGES,
  GRAPH_MAX_NODES,
  GRAPH_MAX_RESPONSE_BYTES,
  GRAPH_MAX_TEXT_LENGTH,
  GRAPH_MAX_WALL_TIME_MS,
  MCP_SECURITY_COLLECTION,
  type ResourceKnowledgeGraph,
} from "../src/graph.ts";
import {
  queryLab,
  runRound2Demo,
} from "../src/lab.ts";

const roots: string[] = [];
const NOW = "2026-07-30T12:00:00.000Z";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })
  ));
});

describe("round-two AgentTool integration", () => {
  test("stores censuses/graphs/vectors/mappings and exposes no remote side effects", async () => {
    const root = await mkdtemp(join(tmpdir(), "hf-kingdom-round2-"));
    roots.push(root);
    const result = await runRound2Demo(root, "security scanner evidence", {
      dtapObserver: async () => dtapFixture(),
      graphObserver: async () => graphFixture(),
      embedderFactory: async () => fakeEmbedder(),
      now: () => new Date(NOW),
    });

    expect(result.protocol).toBe("hf-kingdom-round2-demo/v1");
    expect(result.observations.dtap).toEqual(expect.objectContaining({
      entries: 2,
      complete: true,
      stopped_reason: null,
    }));
    expect(result.observations.graph).toEqual(expect.objectContaining({
      nodes: 3,
      edges: 1,
    }));
    expect(result.semantic.indexed_records).toHaveLength(4);
    expect(result.semantic.hits[0]?.source.fragment_id).toBe("paper:2607.11086");
    expect(result.trackio.mapping_only).toBe(true);
    expect(result.effects).toEqual(expect.objectContaining({
      remote_writes: [],
      inference_requests: [],
      jobs_submitted: [],
      server_started: false,
      peer_sync: false,
      trackio_runtime_started: false,
    }));

    const fts = await queryLab(root, "mapping-only");
    expect(fts.hits.some((hit) =>
      (hit.document as { protocol?: string }).protocol
        === "hf-kingdom-trackio-adapter/v1"
    )).toBe(true);
  });
});

function dtapFixture(): DtapPathCensus {
  return {
    protocol: "hf-kingdom-dtap-path-census/v1",
    observed_at: NOW,
    source: {
      dataset_id: DTAP_DATASET,
      revision: "a".repeat(40),
      canonical_url:
        "https://huggingface.co/datasets/AI-Secure/DTap-Bench-Agent-Trajectories",
    },
    counts: {
      entries: 2,
      files: 1,
      directories: 1,
      unknown: 0,
      declared_file_bytes: 42,
      normalized_path_utf8_bytes: 20,
      maximum_path_depth: 2,
      by_depth: [{ depth: 1, entries: 1 }, { depth: 2, entries: 1 }],
      by_extension: [{ label: ".json", entries: 1, distinct_labels: 1 }],
      by_top_level: [{ label: "claudesdk", entries: 2, distinct_labels: 1 }],
    },
    completeness: {
      complete: true,
      truncated: false,
      stopped_reason: null,
      traversal_order: "hub-tree-order",
      truncated_counts_are_not_representative: true,
    },
    observation_boundary: {
      access: "public-read-without-token",
      transport: "@huggingface/hub:datasetInfo+listFiles",
      assertions_are_untrusted: true,
      private_resources_in_scope: false,
      hub_mutation_in_scope: false,
      file_content_read: false,
      trajectory_bodies_read: false,
      raw_paths_retained: false,
    },
    effects: {
      metadata_requests: 1,
      tree_page_requests: 1,
      metadata_response_body_bytes: 200,
      tree_response_body_bytes: 400,
      remote_writes: [],
      redirect_following: false,
    },
    limits: {
      max_entries: DTAP_MAX_ENTRIES,
      max_tree_pages: DTAP_MAX_TREE_PAGES,
      max_metadata_response_body_bytes: DTAP_MAX_METADATA_RESPONSE_BYTES,
      max_tree_response_body_bytes: DTAP_MAX_TREE_RESPONSE_BYTES,
      max_path_bytes: DTAP_MAX_PATH_BYTES,
      max_total_path_bytes: DTAP_MAX_TOTAL_PATH_BYTES,
      max_path_depth: DTAP_MAX_PATH_DEPTH,
      max_output_buckets_per_dimension: DTAP_MAX_OUTPUT_BUCKETS,
      max_wall_time_ms: 15_000,
      partial_results_marked_truncated: true,
      malformed_entries_fail_closed: true,
    },
  };
}

function graphFixture(): ResourceKnowledgeGraph {
  return {
    protocol: "hf-kingdom-resource-graph/v1",
    observed_at: NOW,
    nodes: [
      {
        id: `collection:${MCP_SECURITY_COLLECTION}`,
        kind: "collection",
        title: "MCP Security",
        canonical_url:
          `https://huggingface.co/collections/${MCP_SECURITY_COLLECTION}`,
        remote_metadata_mutable: true,
        assertions_are_untrusted: true,
      },
      {
        id: "paper:2607.11086",
        kind: "paper",
        title: "Security scanner reliability",
        canonical_url: "https://huggingface.co/papers/2607.11086",
        remote_metadata_mutable: true,
        assertions_are_untrusted: true,
      },
      {
        id: "local-component:receipt",
        kind: "local_component",
        title: "Effects receipt",
        canonical_url: "urn:hf-kingdom-lab:component:receipt",
        remote_metadata_mutable: false,
        assertions_are_untrusted: true,
      },
    ],
    edges: [{
      from: "paper:2607.11086",
      to: "local-component:receipt",
      relation: "curated_design_input",
      assertion_source: "local_curator",
      observed_at: NOW,
      source_url: "https://huggingface.co/papers/2607.11086",
    }],
    observation_boundary: {
      access: "public-read-without-token",
      exact_roots_only: true,
      summaries_retained: false,
      author_profiles_retained: false,
      community_content_retained: false,
      nested_collections_followed: false,
      linked_repositories_auto_fetched: false,
      assertions_are_untrusted: true,
    },
    effects: {
      remote_reads: [
        `https://huggingface.co/api/collections/${MCP_SECURITY_COLLECTION}`,
      ],
      remote_writes: [],
      inference_requests: [],
      jobs_submitted: [],
    },
    limits: {
      max_response_bytes: GRAPH_MAX_RESPONSE_BYTES,
      max_collection_items: GRAPH_MAX_COLLECTION_ITEMS,
      max_nodes: GRAPH_MAX_NODES,
      max_edges: GRAPH_MAX_EDGES,
      max_text_length: GRAPH_MAX_TEXT_LENGTH,
      max_wall_time_ms: GRAPH_MAX_WALL_TIME_MS,
    },
  };
}

function fakeEmbedder(): LocalEmbedder {
  return {
    profile: { ...EMBEDDING_MODEL_PROFILE },
    async embed(texts: string[]): Promise<number[][]> {
      return texts.map((text) => unit(
        text.toLowerCase().includes("scanner") ? 0 : 1,
      ));
    },
    async dispose(): Promise<void> {
      return;
    },
  };
}

function unit(index: number): number[] {
  return Array.from(
    { length: EMBEDDING_DIMENSIONS },
    (_, position) => position === index ? 1 : 0,
  );
}
