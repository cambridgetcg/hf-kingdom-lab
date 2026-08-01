import { describe, expect, test } from "bun:test";
import type { HubResourceSnapshot } from "../src/hub.ts";
import type { IngestOptions, IngestResult } from "../src/lab.ts";
import { recordTreasureMetadata } from "../src/treasure-record.ts";
import {
  findTreasure,
  loadTreasureCatalogue,
  type DatasetTreasure,
} from "../src/treasures.ts";

describe("pinned treasure recording", () => {
  test("reconstructs one exact narrow snapshot for the local AgentTool write", async () => {
    const catalogue = await loadTreasureCatalogue();
    const treasure = findTreasure(catalogue, "NJU-LINK/CodeTraceBench");
    const snapshot = snapshotFor(treasure);
    let calls = 0;
    let received: IngestOptions | undefined;
    const agenttool: IngestResult = {
      node_id: "node-test",
      resources: [{
        resource_type: "dataset",
        repo_id: treasure.repo_id,
        record_id: "record-test",
        content_sha256: "a".repeat(64),
        disposition: "inserted",
      }],
      receipt_record: {
        id: "receipt-test",
        content_sha256: "b".repeat(64),
      },
    };

    const result = await recordTreasureMetadata(treasure, {
      root: "/tmp/unused-treasure-test",
      observer: async () => snapshot,
      now: () => new Date("2026-07-31T20:00:00.000Z"),
      ingester: async (options) => {
        calls += 1;
        received = options;
        const recorded = await options.observer?.("dataset", treasure.repo_id);
        expect(recorded).not.toBe(snapshot);
        expect(recorded).toEqual(snapshot);
        expect(recorded?.resource).not.toBe(snapshot.resource);
        expect(recorded?.observation_boundary).not.toBe(snapshot.observation_boundary);
        expect(recorded?.resource.tags).not.toBe(snapshot.resource.tags);
        return agenttool;
      },
    });

    expect(calls).toBe(1);
    expect(received?.root).toBe("/tmp/unused-treasure-test");
    expect(received?.now?.().toISOString()).toBe("2026-07-31T20:00:00.000Z");
    expect(received?.resources).toEqual([
      { resource_type: "dataset", repo_id: treasure.repo_id },
    ]);
    expect(result).toEqual(expect.objectContaining({
      protocol: "hf-kingdom-dataset-treasure-record/v1",
      repo_id: treasure.repo_id,
      pinned_revision: treasure.revision,
      agenttool,
    }));
    expect(result.limits.join(" ")).toContain("newly reconstructed allowlisted copy");
    expect(result.limits.join(" ")).toContain("No dataset row");
  });

  test("refuses last-modified identity drift before calling the local ingester", async () => {
    const catalogue = await loadTreasureCatalogue();
    const treasure = catalogue.entries[0]!;
    const moved = snapshotFor(treasure);
    moved.resource.updated_at = "2026-08-01T00:00:00.000Z";
    let calls = 0;

    await expect(recordTreasureMetadata(treasure, {
      observer: async () => moved,
      ingester: async () => {
        calls += 1;
        throw new Error("must not run");
      },
    })).rejects.toThrow("identity changed");
    expect(calls).toBe(0);
  });

  test("rejects injected resource text before invoking AgentTool", async () => {
    const catalogue = await loadTreasureCatalogue();
    const treasure = catalogue.entries[0]!;
    const injected = snapshotFor(treasure) as unknown as {
      resource: Record<string, unknown>;
    };
    injected.resource.raw_user_text = "must never reach AgentTool";
    let calls = 0;

    await expect(recordTreasureMetadata(treasure, {
      observer: async () => injected as unknown as HubResourceSnapshot,
      ingester: async () => {
        calls += 1;
        throw new Error("must not run");
      },
    })).rejects.toThrow("snapshot.resource contains unexpected fields");
    expect(calls).toBe(0);
  });
});

function snapshotFor(treasure: DatasetTreasure): HubResourceSnapshot {
  return {
    protocol: "hf-kingdom-resource/v1",
    resource: {
      resource_type: "dataset",
      repo_id: treasure.repo_id,
      canonical_url: treasure.canonical_url,
      hub_object_id: treasure.hub_object_id,
      private: false,
      gated: false,
      disabled: false,
      downloads: treasure.hub_observation.downloads,
      likes: treasure.hub_observation.likes,
      updated_at: treasure.hub_observation.last_modified,
      revision: treasure.revision,
      ...(treasure.hub_observation.hub_license_tag
        ? { tags: [treasure.hub_observation.hub_license_tag] }
        : {}),
    },
    observation_boundary: {
      access: "public-read-without-token",
      transport: "@huggingface/hub",
      assertions_are_untrusted: true,
      private_resources_in_scope: false,
      hub_mutation_in_scope: false,
    },
  };
}
