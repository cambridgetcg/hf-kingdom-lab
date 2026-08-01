import { describe, expect, test } from "bun:test";
import type { HubResourceSnapshot } from "../src/hub.ts";
import {
  FLOW_AXES,
  VIBE_DIMENSIONS,
  assertFlowLensCatalogue,
  buildFlowLensList,
  buildFlowTrace,
  findFlowLens,
  listFlowLenses,
  loadFlowLensCatalogue,
  observeFlowLens,
  type FlowLens,
  type FlowLensCatalogue,
} from "../src/flow-lenses.ts";

describe("situated flow and vibe lenses", () => {
  test("loads a pinned lens for every declared flow shape", async () => {
    const catalogue = await loadFlowLensCatalogue();
    expect(catalogue.entries.length).toBeGreaterThanOrEqual(10);
    expect(catalogue.entries.map((entry) => entry.rank))
      .toEqual(catalogue.entries.map((_, index) => index + 1));
    expect(new Set(catalogue.entries.map((entry) => entry.repo_id)).size)
      .toBe(catalogue.entries.length);
    for (const axis of FLOW_AXES) {
      expect(catalogue.entries.some((entry) => entry.flow.axis === axis)).toBe(true);
    }
    expect(catalogue.dimensions).toEqual([...VIBE_DIMENSIONS]);
    expect(catalogue.boundary).toEqual(expect.objectContaining({
      disagreement_is_data: true,
      no_universal_vibe_score: true,
      no_person_worth_or_identity_inference: true,
      no_demographic_taste_inference: true,
      remote_rows_collected: false,
      remote_files_collected: false,
      hub_mutation: false,
    }));
  });

  test("keeps human judgment, description, and control origins explicit", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const modelOnly = catalogue.entries.filter((entry) =>
      entry.evidence.observer_origin === "model"
    );
    expect(modelOnly.length).toBeGreaterThan(0);
    expect(modelOnly.every((entry) =>
      !entry.evidence.epistemic_layers.includes("normative")
      && entry.route.forbidden.includes("human-ground-truth-claim")
    )).toBe(true);

    const invalid = structuredClone(catalogue) as FlowLensCatalogue;
    const simulated = invalid.entries.find((entry) =>
      entry.evidence.observer_origin === "model"
    );
    if (!simulated) throw new Error("fixture has no model-only lens");
    simulated.evidence.epistemic_layers = ["normative"];
    expect(() => assertFlowLensCatalogue(invalid)).toThrow(
      "cannot label model-only evidence as a normative human preference",
    );
  });

  test("keeps the catalogue and live metadata snapshot closed to hidden bodies", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const topLevel = structuredClone(catalogue) as unknown as Record<string, unknown>;
    topLevel.raw_dataset_rows = [];
    expect(() => assertFlowLensCatalogue(topLevel)).toThrow(
      "catalogue must contain exactly",
    );

    const entryExtra = structuredClone(catalogue) as unknown as {
      entries: Array<Record<string, unknown>>;
    };
    entryExtra.entries[0]!.raw_user_text = "must never be accepted";
    expect(() => assertFlowLensCatalogue(entryExtra)).toThrow(
      "catalogue.entries[0] must contain exactly",
    );

    const hiddenExtra = structuredClone(catalogue) as unknown as {
      entries: Array<Record<string, unknown>>;
    };
    Object.defineProperty(hiddenExtra.entries[0]!, "hidden_body", {
      value: "must never be accepted",
      enumerable: false,
    });
    expect(() => assertFlowLensCatalogue(hiddenExtra)).toThrow(
      "catalogue.entries[0] must contain exactly",
    );

    const entry = catalogue.entries[0]!;
    const snapshot = snapshotFor(entry) as unknown as {
      resource: Record<string, unknown>;
    };
    snapshot.resource.raw_user_text = "must never reach AgentTool";
    await expect(observeFlowLens(entry, {
      observer: async () => snapshot as unknown as HubResourceSnapshot,
    })).rejects.toThrow("snapshot.resource contains unexpected fields");

    const symbolSnapshot = snapshotFor(entry) as unknown as {
      resource: Record<string | symbol, unknown>;
    };
    symbolSnapshot.resource[Symbol("body")] = "must never reach AgentTool";
    await expect(observeFlowLens(entry, {
      observer: async () => symbolSnapshot as unknown as HubResourceSnapshot,
    })).rejects.toThrow("snapshot.resource contains unexpected symbol fields");

    const bodyChannels: Array<{
      field: "author" | "created_at" | "arrays_truncated" | "tags";
      value: unknown;
      message: string;
    }> = [
      {
        field: "author",
        value: { raw_user_text: "secret body" },
        message: "observed resource author must be a bounded non-empty string",
      },
      {
        field: "author",
        value: "x".repeat(257),
        message: "observed resource author must be a bounded non-empty string",
      },
      {
        field: "created_at",
        value: "not-an-instant",
        message: "observed resource created_at must be an ISO UTC instant",
      },
      {
        field: "arrays_truncated",
        value: { instance_body: "payload" },
        message: "invalid arrays_truncated state",
      },
      {
        field: "tags",
        value: Array.from({ length: 101 }, (_, index) => `tag-${index}`),
        message: "observed resource tags must contain 0-100 strings",
      },
      {
        field: "tags",
        value: ["x".repeat(513)],
        message: "observed resource tags[0] must be a bounded non-empty string",
      },
    ];
    for (const bodyChannel of bodyChannels) {
      const injected = snapshotFor(entry) as unknown as {
        resource: Record<string, unknown>;
      };
      injected.resource[bodyChannel.field] = bodyChannel.value;
      await expect(observeFlowLens(entry, {
        observer: async () => injected as unknown as HubResourceSnapshot,
      })).rejects.toThrow(bodyChannel.message);
    }

    const objectRevision = snapshotFor(entry) as unknown as {
      resource: { revision: unknown };
    };
    objectRevision.resource.revision = {
      toString: () => entry.revision,
      raw_instance_body: "payload",
    };
    await expect(observeFlowLens(entry, {
      observer: async () => objectRevision as unknown as HubResourceSnapshot,
    })).rejects.toThrow("invalid revision");

    const tagged = snapshotFor(entry);
    Object.defineProperty(tagged.resource.tags!, "instance_body", {
      value: "payload",
      enumerable: false,
    });
    await expect(observeFlowLens(entry, {
      observer: async () => tagged,
    })).rejects.toThrow("observed resource tags must be a dense data-only array");
  });

  test("refuses universalization and unsafe identity routes", async () => {
    const catalogue = await loadFlowLensCatalogue();
    expect(catalogue.entries.every((entry) =>
      entry.route.forbidden.includes("universal-vibe-score")
    )).toBe(true);
    const sensitive = catalogue.entries.filter((entry) =>
      entry.evidence.identity_surface === "sensitive-pseudonymous"
    );
    expect(sensitive.length).toBeGreaterThan(0);
    expect(sensitive.every((entry) =>
      entry.route.forbidden.includes("reidentification")
      && entry.route.forbidden.includes("demographic-inference")
      && entry.route.mode !== "bounded-sample-after-review"
    )).toBe(true);

    const invalid = structuredClone(catalogue) as FlowLensCatalogue;
    const firstSensitive = invalid.entries.find((entry) =>
      entry.evidence.identity_surface === "sensitive-pseudonymous"
    );
    if (!firstSensitive) throw new Error("fixture has no sensitive lens");
    firstSensitive.route.forbidden = firstSensitive.route.forbidden.filter((item) =>
      item !== "demographic-inference"
    );
    expect(() => assertFlowLensCatalogue(invalid)).toThrow(
      "must explicitly forbid demographic inference",
    );
  });

  test("gates licence conflicts and Viewer representation mismatches", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const restricted = catalogue.entries.filter((entry) =>
      entry.license.status === "conflicting" || entry.license.status === "custom"
    );
    expect(restricted.length).toBeGreaterThan(0);
    expect(restricted.every((entry) =>
      entry.route.mode === "metadata-only" || entry.route.mode === "schema-only"
    )).toBe(true);
    const mismatched = catalogue.entries.filter((entry) =>
      entry.viewer.status === "mismatched"
    );
    expect(mismatched.length).toBeGreaterThanOrEqual(3);
    expect(mismatched.every((entry) =>
      entry.route.mode === "metadata-only" || entry.route.mode === "schema-only"
    )).toBe(true);

    const invalid = structuredClone(catalogue) as FlowLensCatalogue;
    const firstMismatch = invalid.entries.find((entry) =>
      entry.viewer.status === "mismatched"
    );
    if (!firstMismatch) throw new Error("fixture has no Viewer mismatch");
    firstMismatch.route.mode = "aggregate-after-review";
    expect(() => assertFlowLensCatalogue(invalid)).toThrow(
      "cannot aggregate/sample before resolving a Viewer representation mismatch",
    );
  });

  test("filters exact domains and identities", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const music = findFlowLens(catalogue, "amaai-lab/MERP");
    expect(music.domain).toBe("music");
    expect(listFlowLenses(catalogue, { domain: "music" })).toEqual([music]);
    expect(() => findFlowLens(catalogue, "amaai-lab/merp")).toThrow(
      "exactly match a curated flow lens",
    );
    expect(buildFlowLensList(catalogue, { role: "calibration-anchor" })).toEqual(
      expect.objectContaining({
        protocol: "hf-kingdom-flow-lens-list/v1",
        filter: { domain: null, role: "calibration-anchor" },
        entries: [findFlowLens(catalogue, "OpenAssistant/oasst2")],
      }),
    );
  });

  test("builds a trace that names transformations and losses", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const trace = buildFlowTrace(findFlowLens(catalogue, "amaai-lab/MERP"));
    expect(trace.protocol).toBe("hf-kingdom-flow-trace/v1");
    expect(trace.axis).toBe("continuous-time");
    expect(trace.stages.map((stage) => stage.order)).toEqual([1, 2, 3, 4]);
    expect(trace.preserves.length).toBeGreaterThan(0);
    expect(trace.loses.length).toBeGreaterThan(0);
    expect(trace.observation_unit).toContain("sampling grid unresolved");
    expect(trace.uncertainty_evidence).toEqual(expect.objectContaining({
      viewer_status: "mismatched",
      nuances: expect.arrayContaining([
        expect.stringContaining("0.5-second downsampled stage"),
      ]),
    }));
    expect(trace.interpretation_boundary).toEqual(expect.objectContaining({
      situated_observation_not_essence: true,
      no_universal_score: true,
    }));
  });

  test("separates identity drift from volatile attention", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const entry = findFlowLens(catalogue, "amaai-lab/MERP");
    const snapshot = snapshotFor(entry, {
      downloads: entry.hub_observation.downloads + 7,
      likes: entry.hub_observation.likes + 1,
    });
    const observed = await observeFlowLens(entry, {
      observer: async () => snapshot,
      now: () => new Date("2026-08-01T08:00:00.000Z"),
    });
    expect(observed.drift.identity_changed).toBe(false);
    expect(observed.drift.attention_delta).toEqual({ downloads: 7, likes: 1 });
    expect(observed.drift.boundary).toEqual({
      public_metadata_read_only: true,
      dataset_bodies_read: false,
      remote_writes: false,
    });

    const changed = structuredClone(snapshot);
    changed.resource.revision = "0".repeat(40);
    const drifted = await observeFlowLens(entry, {
      observer: async () => changed,
      now: () => new Date("2026-08-01T08:01:00.000Z"),
    });
    expect(drifted.drift.identity_changed).toBe(true);
  });

  test("rejects injected snapshots that escape the public exact identity", async () => {
    const catalogue = await loadFlowLensCatalogue();
    const entry = catalogue.entries[0]!;
    const wrong = snapshotFor(entry);
    wrong.resource.repo_id = "other/dataset";
    await expect(observeFlowLens(entry, {
      observer: async () => wrong,
    })).rejects.toThrow("different resource identity");

    const unsafe = snapshotFor(entry);
    const cast = unsafe as unknown as {
      observation_boundary: { access: string };
    };
    cast.observation_boundary.access = "credentialed-private-read";
    await expect(observeFlowLens(entry, {
      observer: async () => unsafe,
    })).rejects.toThrow("unsafe observation boundary");

    const malformed = snapshotFor(entry) as unknown as {
      resource: { gated: string };
    };
    malformed.resource.gated = "yes";
    await expect(observeFlowLens(entry, {
      observer: async () => malformed as unknown as HubResourceSnapshot,
    })).rejects.toThrow("invalid gated state");
  });
});

function snapshotFor(
  entry: FlowLens,
  counts: { downloads?: number; likes?: number } = {},
): HubResourceSnapshot {
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
      downloads: counts.downloads ?? entry.hub_observation.downloads,
      likes: counts.likes ?? entry.hub_observation.likes,
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
