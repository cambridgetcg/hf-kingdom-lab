import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { canonicalJson } from "@agenttool/data";
import {
  EMBEDDING_MANIFEST_SHA256,
  EMBEDDING_REVISION,
} from "../src/embedding.ts";

interface Artifact {
  agenttool: { content_sha256: string };
  aggregate?: {
    rows: Array<{ repository_count: number }>;
  };
  receipt?: unknown;
}

const ROOT = resolve(import.meta.dir, "..");

describe("saved AgentTool evidence", () => {
  test("matches the canonical content hashes stored by the local node", async () => {
    for (const relative of [
      "artifacts/hf/public-resource-ingest-20260730.json",
      "artifacts/hf/mcpshield-grade-aggregate-20260730.json",
      "artifacts/hf/mcpshield-grade-aggregate-20260730-direct-python.json",
      "artifacts/hf/mcpshield-grade-aggregate-20260730-uv-run-superseded.json",
    ]) {
      const artifact = await Bun.file(resolve(ROOT, relative)).json() as Artifact;
      const payload = artifact.receipt ?? artifact.aggregate;
      expect(payload).toBeDefined();
      const digest = createHash("sha256")
        .update(canonicalJson(payload))
        .digest("hex");
      expect(digest).toBe(artifact.agenttool.content_sha256);
    }
  });

  test("keeps only the five aggregate grade rows", async () => {
    const artifact = await Bun.file(resolve(
      ROOT,
      "artifacts/hf/mcpshield-grade-aggregate-20260730-direct-python.json",
    )).json() as Artifact;
    const rows = artifact.aggregate?.rows ?? [];
    expect(rows).toHaveLength(5);
    expect(rows.reduce((total, row) => total + row.repository_count, 0)).toBe(6_767);
  });

  test("retains the reviewed uv-run artifact as superseded evidence", async () => {
    const artifact = await Bun.file(resolve(
      ROOT,
      "artifacts/hf/mcpshield-grade-aggregate-20260730-uv-run-superseded.json",
    )).json() as Artifact & {
      status?: string;
      correction?: { replacement?: string; review_id?: string };
    };
    expect(artifact.status).toBe("superseded");
    expect(artifact.correction).toEqual(expect.objectContaining({
      replacement: "artifacts/hf/mcpshield-grade-aggregate-20260730-direct-python.json",
      review_id: "review_091b8d60-0048-4654-9e02-6ff506fe38f7",
    }));
  });

  test("keeps round-two live claims inside the implemented effect boundary", async () => {
    const artifact = await Bun.file(resolve(
      ROOT,
      "artifacts/round2/live-evidence-20260730.json",
    )).json() as {
      embedding_prepare: {
        revision: string;
        manifest_sha256: string;
        bytes: number;
      };
      round2: {
        dtap: {
          entries: number;
          complete: boolean;
          stopped_reason: string;
          truncated_counts_are_not_representative: boolean;
          trajectory_bodies_read: boolean;
        };
        semantic: { classification: string; indexed_records: number };
        trackio: {
          mapping_only: boolean;
          runtime_started: boolean;
          native_storage_written: boolean;
        };
      };
      effects: {
        remote_writes: unknown[];
        remote_inference_requests: unknown[];
        jobs_submitted: unknown[];
        spaces_invoked: unknown[];
        buckets_used: unknown[];
        server_started: boolean;
      };
    };
    expect(artifact.embedding_prepare).toEqual(expect.objectContaining({
      revision: EMBEDDING_REVISION,
      manifest_sha256: EMBEDDING_MANIFEST_SHA256,
      bytes: 23_685_047,
    }));
    expect(artifact.round2.dtap).toEqual(expect.objectContaining({
      entries: 10_000,
      complete: false,
      stopped_reason: "page_limit",
      truncated_counts_are_not_representative: true,
      trajectory_bodies_read: false,
    }));
    expect(artifact.round2.semantic).toEqual(expect.objectContaining({
      classification: "derived_unverified_signal",
      indexed_records: 7,
    }));
    expect(artifact.round2.trackio).toEqual(expect.objectContaining({
      mapping_only: true,
      runtime_started: false,
      native_storage_written: false,
    }));
    expect(artifact.effects).toEqual(expect.objectContaining({
      remote_writes: [],
      remote_inference_requests: [],
      jobs_submitted: [],
      spaces_invoked: [],
      buckets_used: [],
      server_started: false,
    }));
  });
});
