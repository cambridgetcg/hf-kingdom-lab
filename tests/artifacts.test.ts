import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { canonicalJson } from "@agenttool/data";

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
});
