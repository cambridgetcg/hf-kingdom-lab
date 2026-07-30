import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLabNode } from "../src/store.ts";
import {
  collectTrackioMapping,
  createTrackioMapping,
  TRACKIO_VERSION,
  validateTrackioMapping,
} from "../src/trackio.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })
  ));
});

describe("Trackio mapping-only adapter", () => {
  test("sorts deterministic config/metrics and states every non-effect", async () => {
    const mapping = createTrackioMapping({
      project: "hf-kingdom-lab",
      run_id: "round2-test",
      observed_at: "2026-07-30T12:00:00.000Z",
      config: { zeta: true, alpha: "local" },
      steps: [
        {
          step: 1,
          timestamp: "2026-07-30T12:00:01.000Z",
          metrics: { "semantic.hits": 5, "graph.nodes": 6 },
        },
        {
          step: 0,
          timestamp: "2026-07-30T12:00:00.000Z",
          metrics: { "dtap.entries": 10_000 },
        },
      ],
      input_record_ids: ["record-b", "record-a", "record-a"],
    });

    expect(mapping.target.version).toBe(TRACKIO_VERSION);
    expect(Object.keys(mapping.mapping.config)).toEqual(["alpha", "zeta"]);
    expect(mapping.mapping.metrics.map((row) => row.step)).toEqual([0, 1]);
    expect(Object.keys(mapping.mapping.metrics[1]!.metrics))
      .toEqual(["graph.nodes", "semantic.hits"]);
    expect(mapping.provenance.input_record_ids).toEqual(["record-a", "record-b"]);
    expect(mapping.effects).toEqual({
      mapping_only: true,
      trackio_imported: false,
      trackio_runtime_started: false,
      native_sqlite_or_parquet_written: false,
      hardware_logging_started: false,
      dashboard_started: false,
      mcp_server_started: false,
      huggingface_sync_started: false,
      remote_reads: [],
      remote_writes: [],
    });
    const tampered = {
      ...mapping,
      effects: {
        ...mapping.effects,
        trackio_runtime_started: true,
      },
    } as unknown as typeof mapping;
    expect(() => validateTrackioMapping(tampered)).toThrow("closed schema");

    const root = await mkdtemp(join(tmpdir(), "hf-kingdom-trackio-"));
    roots.push(root);
    const node = await openLabNode(root);
    try {
      const record = await collectTrackioMapping(node, mapping);
      expect(record.collection_id).toBe("hf-trackio-mappings-v1");
    } finally {
      node.close();
    }
  });

  test("rejects non-finite metrics, duplicate steps, and unsafe identifiers", () => {
    const base = {
      project: "hf-kingdom-lab",
      run_id: "round2-test",
      observed_at: "2026-07-30T12:00:00.000Z",
      config: {},
      input_record_ids: ["record-a"],
    };
    expect(() => createTrackioMapping({
      ...base,
      steps: [{
        step: 0,
        timestamp: base.observed_at,
        metrics: { score: Number.NaN },
      }],
    })).toThrow("finite");
    expect(() => createTrackioMapping({
      ...base,
      steps: [0, 0].map((step) => ({
        step,
        timestamp: base.observed_at,
        metrics: { score: 1 },
      })),
    })).toThrow("unique");
    expect(() => createTrackioMapping({
      ...base,
      project: "../escape",
      steps: [{
        step: 0,
        timestamp: base.observed_at,
        metrics: { score: 1 },
      }],
    })).toThrow("project");
  });
});
