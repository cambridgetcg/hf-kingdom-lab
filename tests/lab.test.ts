import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HubResourceSnapshot } from "../src/hub.ts";
import {
  resolveDefaultDataRoot,
  ingestResources,
  inspectLab,
  queryLab,
} from "../src/lab.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
  })));
});

describe("local AgentTool data integration", () => {
  test("keeps installed-package state out of node_modules by default", () => {
    expect(resolveDefaultDataRoot({}, "darwin", "/Users/demo"))
      .toBe("/Users/demo/Library/Application Support/hf-kingdom-lab");
    expect(resolveDefaultDataRoot({}, "linux", "/home/demo"))
      .toBe("/home/demo/.local/share/hf-kingdom-lab");
    expect(resolveDefaultDataRoot(
      { XDG_DATA_HOME: "/srv/agent-data" },
      "linux",
      "/home/demo",
    )).toBe("/srv/agent-data/hf-kingdom-lab");
    expect(resolveDefaultDataRoot(
      { HFKL_DATA_ROOT: "/tmp/explicit-hfkl" },
      "linux",
      "/home/demo",
    )).toBe("/tmp/explicit-hfkl");
    expect(() => resolveDefaultDataRoot(
      { HFKL_DATA_ROOT: "relative/path" },
      "linux",
      "/home/demo",
    )).toThrow("HFKL_DATA_ROOT must be a bounded absolute path");
  });

  test("deduplicates resource bytes while recording each run receipt", async () => {
    const root = await mkdtemp(join(tmpdir(), "hf-kingdom-lab-"));
    roots.push(root);
    const snapshot: HubResourceSnapshot = {
      protocol: "hf-kingdom-resource/v1",
      resource: {
        resource_type: "dataset",
        repo_id: "demo/DTap",
        canonical_url: "https://huggingface.co/datasets/demo/DTap",
        hub_object_id: "dataset-object",
        private: false,
        likes: 1,
        downloads: 2,
        updated_at: "2026-07-01T00:00:00.000Z",
        revision: "revision-1",
        tags: ["agent", "security"],
      },
      observation_boundary: {
        access: "public-read-without-token",
        transport: "@huggingface/hub",
        assertions_are_untrusted: true,
        private_resources_in_scope: false,
        hub_mutation_in_scope: false,
      },
    };
    const observer = async () => snapshot;
    const resources = [{
      resource_type: "dataset" as const,
      repo_id: "demo/DTap",
    }];

    const first = await ingestResources({
      root,
      resources,
      observer,
      now: () => new Date("2026-07-30T10:00:00.000Z"),
      runId: () => "run-one",
    });
    const second = await ingestResources({
      root,
      resources,
      observer,
      now: () => new Date("2026-07-30T10:01:00.000Z"),
      runId: () => "run-two",
    });

    expect(first.resources[0]?.disposition).toBe("inserted");
    expect(second.resources[0]?.disposition).toBe("existing");
    expect(first.resources[0]?.record_id).toBe(second.resources[0]?.record_id);
    expect(first.receipt_record.id).not.toBe(second.receipt_record.id);

    const query = await queryLab(root, "security");
    expect(query.consistency).toBe("local");
    expect(query.hits.some((hit) =>
      (hit.document as { protocol?: string }).protocol === "hf-kingdom-resource/v1"
    )).toBe(true);

    const doctor = await inspectLab(root) as {
      boundary: { server_started: boolean; peer_sync: boolean };
    };
    expect(doctor.boundary).toEqual(expect.objectContaining({
      server_started: false,
      peer_sync: false,
    }));
  });
});
