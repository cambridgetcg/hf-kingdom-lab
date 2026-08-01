import { describe, expect, test } from "bun:test";
import type { HubResourceSnapshot } from "../src/hub.ts";
import type { IngestOptions, IngestResult } from "../src/lab.ts";
import { recordFlowLensMetadata } from "../src/flow-record.ts";
import {
  findFlowLens,
  loadFlowLensCatalogue,
  type FlowLens,
} from "../src/flow-lenses.ts";

describe("pinned flow-lens recording", () => {
  test("reconstructs one exact narrow snapshot for the local AgentTool write", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const entry = findFlowLens(catalogue, "amaai-lab/MERP");
    const snapshot = snapshotFor(entry);
    let calls = 0;
    let received: IngestOptions | undefined;
    const agenttool: IngestResult = {
      node_id: "node-flow-test",
      resources: [{
        resource_type: "dataset",
        repo_id: entry.repo_id,
        record_id: "record-flow-test",
        content_sha256: "a".repeat(64),
        disposition: "inserted",
      }],
      receipt_record: {
        id: "receipt-flow-test",
        content_sha256: "b".repeat(64),
      },
    };

    const result = await recordFlowLensMetadata(entry, {
      root: "/tmp/unused-flow-test",
      observer: async () => snapshot,
      now: () => new Date("2026-08-01T08:10:00.000Z"),
      ingester: async (options) => {
        calls += 1;
        received = options;
        const recorded = await options.observer?.("dataset", entry.repo_id);
        expect(recorded).not.toBe(snapshot);
        expect(recorded).toEqual(snapshot);
        return agenttool;
      },
    });

    expect(calls).toBe(1);
    expect(received?.root).toBe("/tmp/unused-flow-test");
    expect(received?.now?.().toISOString()).toBe("2026-08-01T08:10:00.000Z");
    expect(result).toEqual(expect.objectContaining({
      protocol: "hf-kingdom-flow-lens-record/v1",
      repo_id: entry.repo_id,
      pinned_revision: entry.revision,
      lens: {
        domain: "music",
        axis: "continuous-time",
        observer_origin: "human",
        route: "schema-only",
      },
      agenttool,
    }));
    expect(result.limits.join(" ")).toContain("No dataset row");
  });

  test("refuses identity drift before invoking AgentTool", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const entry = catalogue.entries[0]!;
    const moved = snapshotFor(entry);
    moved.resource.revision = "0".repeat(40);
    let calls = 0;

    await expect(recordFlowLensMetadata(entry, {
      observer: async () => moved,
      ingester: async () => {
        calls += 1;
        throw new Error("must not run");
      },
    })).rejects.toThrow("identity changed");
    expect(calls).toBe(0);
  });
});

function snapshotFor(entry: FlowLens): HubResourceSnapshot {
  return {
    protocol: "hf-kingdom-resource/v1",
    resource: {
      resource_type: "dataset",
      repo_id: entry.repo_id,
      canonical_url: entry.canonical_url,
      hub_object_id: entry.hub_object_id,
      private: false,
      gated: false,
      disabled: false,
      downloads: entry.hub_observation.downloads,
      likes: entry.hub_observation.likes,
      updated_at: entry.hub_observation.last_modified,
      revision: entry.revision,
      tags: [entry.hub_observation.hub_license_tag],
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
