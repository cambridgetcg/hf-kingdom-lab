import { describe, expect, test } from "bun:test";
import type { HubResourceSnapshot } from "../src/hub.ts";
import {
  TREASURE_PHASES,
  assertTreasureCatalogue,
  buildTreasureList,
  findTreasure,
  listTreasures,
  loadTreasureCatalogue,
  observeTreasure,
  type DatasetTreasure,
  type TreasureCatalogue,
} from "../src/treasures.ts";

describe("training archaeology atlas", () => {
  test("loads one validated treasure for every declared phase", async () => {
    const catalogue = await loadTreasureCatalogue();
    expect(catalogue.entries.length).toBeGreaterThanOrEqual(TREASURE_PHASES.length);
    expect(new Set(catalogue.entries.map((entry) => entry.repo_id)).size)
      .toBe(catalogue.entries.length);
    for (const phase of TREASURE_PHASES) {
      expect(catalogue.entries.some((entry) => entry.phase === phase)).toBe(true);
    }
    expect(catalogue.entries.map((entry) => entry.rank))
      .toEqual(catalogue.entries.map((_, index) => index + 1));
    expect(catalogue.boundary).toEqual(expect.objectContaining({
      remote_rows_collected: false,
      remote_files_collected: false,
      hub_mutation: false,
    }));
  });

  test("closes every catalogue object and array to hidden body channels", async () => {
    const catalogue = await loadTreasureCatalogue();

    const topLevel = structuredClone(catalogue) as unknown as Record<string, unknown>;
    topLevel.raw_dataset_rows = [];
    expect(() => assertTreasureCatalogue(topLevel)).toThrow(
      "catalogue must contain exactly",
    );

    const hiddenEntry = structuredClone(catalogue) as unknown as {
      entries: Array<Record<string, unknown>>;
    };
    Object.defineProperty(hiddenEntry.entries[0]!, "hidden_body", {
      value: "must never be accepted",
      enumerable: false,
    });
    expect(() => assertTreasureCatalogue(hiddenEntry)).toThrow(
      "catalogue.entries[0] must contain exactly",
    );

    const symbolNested = structuredClone(catalogue) as unknown as {
      entries: Array<{ viewer: Record<string | symbol, unknown> }>;
    };
    symbolNested.entries[0]!.viewer[Symbol("body")] = "must never be accepted";
    expect(() => assertTreasureCatalogue(symbolNested)).toThrow(
      "catalogue.entries[0].viewer contains unexpected symbol fields",
    );

    const customEntries = structuredClone(catalogue);
    Object.defineProperty(customEntries.entries, "instance_body", {
      value: "must never be accepted",
      enumerable: false,
    });
    expect(() => assertTreasureCatalogue(customEntries)).toThrow(
      "catalogue.entries must be a dense data-only array",
    );

    const customNestedArray = structuredClone(catalogue);
    (customNestedArray.entries[0]!.risks as unknown as Record<symbol, unknown>)[
      Symbol("body")
    ] = "must never be accepted";
    expect(() => assertTreasureCatalogue(customNestedArray)).toThrow(
      "catalogue.entries[0].risks must be a dense data-only array",
    );
  });

  test("keeps missing licences on metadata/schema-only routes", async () => {
    const catalogue = await loadTreasureCatalogue();
    const missing = catalogue.entries.filter((entry) => entry.license.status === "missing");
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((entry) =>
      entry.kingdom_route.mode === "metadata-only"
      || entry.kingdom_route.mode === "schema-only"
    )).toBe(true);

    const invalid = structuredClone(catalogue) as TreasureCatalogue;
    const firstMissing = invalid.entries.find((entry) => entry.license.status === "missing");
    if (!firstMissing) throw new Error("test fixture has no missing-licence entry");
    firstMissing.kingdom_route.mode = "bounded-sample-after-review";
    expect(() => assertTreasureCatalogue(invalid)).toThrow(
      "cannot route missing-licence content beyond metadata/schema",
    );

    const relabelled = structuredClone(catalogue) as TreasureCatalogue;
    const relabelledMissing = relabelled.entries.find((entry) =>
      entry.license.status === "missing"
    );
    if (!relabelledMissing) throw new Error("test fixture has no missing-licence entry");
    relabelledMissing.license.status = "declared";
    relabelledMissing.license.expression = "MIT";
    relabelledMissing.kingdom_route.mode = "bounded-sample-after-review";
    expect(() => assertTreasureCatalogue(relabelled)).toThrow(
      "cannot declare a licence absent from the observed Hub tag",
    );
  });

  test("rejects content routes that require a usable Viewer", async () => {
    const catalogue = await loadTreasureCatalogue();
    const invalid = structuredClone(catalogue) as TreasureCatalogue;
    const unsupported = invalid.entries.find((entry) => entry.viewer.status === "unsupported");
    if (!unsupported) throw new Error("test fixture has no unsupported Viewer entry");
    unsupported.kingdom_route.mode = "aggregate-first";
    expect(() => assertTreasureCatalogue(invalid)).toThrow(
      "requires a usable Viewer before its selected content route",
    );
  });

  test("selects only exact curated identities and phases", async () => {
    const catalogue = await loadTreasureCatalogue();
    const selected = findTreasure(catalogue, "NJU-LINK/CodeTraceBench");
    expect(selected.phase).toBe("agent-process-evaluation");
    expect(listTreasures(catalogue, "agent-process-evaluation"))
      .toEqual([selected]);
    expect(() => findTreasure(catalogue, "NJU-LINK/codetracebench")).toThrow(
      "exactly match a curated dataset treasure",
    );

    const list = buildTreasureList(catalogue, "agent-process-evaluation");
    expect(list).toEqual(expect.objectContaining({
      protocol: "hf-kingdom-dataset-treasure-list/v1",
      catalogue_protocol: "hf-kingdom-dataset-treasures/v1",
      filter: { phase: "agent-process-evaluation" },
      entries: [selected],
    }));
  });

  test("separates identity drift from volatile attention counts", async () => {
    const catalogue = await loadTreasureCatalogue();
    const treasure = findTreasure(catalogue, "NJU-LINK/CodeTraceBench");
    const snapshot = snapshotFor(treasure, {
      downloads: treasure.hub_observation.downloads + 11,
      likes: treasure.hub_observation.likes + 2,
    });
    snapshot.resource.author = "NJU-LINK";
    snapshot.resource.created_at = "2026-04-01T00:00:00.000Z";
    snapshot.resource.arrays_truncated = false;
    const observed = await observeTreasure(treasure, {
      observer: async () => snapshot,
      now: () => new Date("2026-07-31T19:00:00.000Z"),
    });
    expect(observed.snapshot).not.toBe(snapshot);
    expect(observed.snapshot).toEqual(snapshot);
    expect(observed.snapshot.resource).not.toBe(snapshot.resource);
    expect(observed.snapshot.observation_boundary).not.toBe(snapshot.observation_boundary);
    if (snapshot.resource.tags) {
      expect(observed.snapshot.resource.tags).not.toBe(snapshot.resource.tags);
    }
    expect(observed.drift.identity_changed).toBe(false);
    expect(observed.drift.attention_delta).toEqual({ downloads: 11, likes: 2 });
    expect(observed.drift.boundary).toEqual({
      public_metadata_read_only: true,
      dataset_bodies_read: false,
      remote_writes: false,
    });

    const moved = structuredClone(snapshot);
    moved.resource.revision = "0".repeat(40);
    const drifted = await observeTreasure(treasure, {
      observer: async () => moved,
      now: () => new Date("2026-07-31T19:01:00.000Z"),
    });
    expect(drifted.drift.identity_changed).toBe(true);

    const updated = structuredClone(snapshot);
    updated.resource.updated_at = "2026-04-14T09:07:54.000Z";
    const timestampDrift = await observeTreasure(treasure, {
      observer: async () => updated,
      now: () => new Date("2026-07-31T19:01:30.000Z"),
    });
    expect(timestampDrift.drift.identity_changed).toBe(true);

    const missingDisabled = structuredClone(snapshot);
    delete missingDisabled.resource.disabled;
    const uncertain = await observeTreasure(treasure, {
      observer: async () => missingDisabled,
      now: () => new Date("2026-07-31T19:02:00.000Z"),
    });
    expect(uncertain.drift.identity_changed).toBe(true);
  });

  test("rejects an observer response for a different dataset", async () => {
    const catalogue = await loadTreasureCatalogue();
    const treasure = catalogue.entries[0]!;
    const snapshot = snapshotFor(treasure);
    snapshot.resource.repo_id = "other/dataset";
    await expect(observeTreasure(treasure, {
      observer: async () => snapshot,
    })).rejects.toThrow("returned a different resource");
  });

  test("rejects an injected snapshot that crosses the public evidence boundary", async () => {
    const catalogue = await loadTreasureCatalogue();
    const treasure = catalogue.entries[0]!;
    const snapshot = snapshotFor(treasure);
    const unsafe = structuredClone(snapshot) as unknown as {
      protocol: string;
      observation_boundary: { access: string };
    };
    unsafe.protocol = "evil/v1";
    unsafe.observation_boundary.access = "credentialed-private-read";
    await expect(observeTreasure(treasure, {
      observer: async () => unsafe as unknown as HubResourceSnapshot,
    })).rejects.toThrow("different resource identity");

    unsafe.protocol = "hf-kingdom-resource/v1";
    await expect(observeTreasure(treasure, {
      observer: async () => unsafe as unknown as HubResourceSnapshot,
    })).rejects.toThrow("unsafe observation boundary");
  });

  test("rejects hidden snapshot fields and optional-field body channels", async () => {
    const catalogue = await loadTreasureCatalogue();
    const treasure = catalogue.entries[0]!;

    const outerExtra = snapshotFor(treasure) as unknown as Record<string, unknown>;
    outerExtra.raw_user_text = "must never reach AgentTool";
    await expect(observeTreasure(treasure, {
      observer: async () => outerExtra as unknown as HubResourceSnapshot,
    })).rejects.toThrow("treasure snapshot must contain exactly");

    const boundaryExtra = snapshotFor(treasure) as unknown as {
      observation_boundary: Record<string, unknown>;
    };
    boundaryExtra.observation_boundary.raw_user_text = "must never reach AgentTool";
    await expect(observeTreasure(treasure, {
      observer: async () => boundaryExtra as unknown as HubResourceSnapshot,
    })).rejects.toThrow("treasure snapshot.observation_boundary must contain exactly");

    const resourceExtra = snapshotFor(treasure) as unknown as {
      resource: Record<string, unknown>;
    };
    resourceExtra.resource.raw_user_text = "must never reach AgentTool";
    await expect(observeTreasure(treasure, {
      observer: async () => resourceExtra as unknown as HubResourceSnapshot,
    })).rejects.toThrow("treasure snapshot.resource contains unexpected fields");

    const hiddenResource = snapshotFor(treasure);
    Object.defineProperty(hiddenResource.resource, "hidden_body", {
      value: "must never reach AgentTool",
      enumerable: false,
    });
    await expect(observeTreasure(treasure, {
      observer: async () => hiddenResource,
    })).rejects.toThrow("treasure snapshot.resource contains unexpected fields");

    const symbolResource = snapshotFor(treasure) as unknown as {
      resource: Record<string | symbol, unknown>;
    };
    symbolResource.resource[Symbol("body")] = "must never reach AgentTool";
    await expect(observeTreasure(treasure, {
      observer: async () => symbolResource as unknown as HubResourceSnapshot,
    })).rejects.toThrow("treasure snapshot.resource contains unexpected symbol fields");

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
      const injected = snapshotFor(treasure) as unknown as {
        resource: Record<string, unknown>;
      };
      injected.resource[bodyChannel.field] = bodyChannel.value;
      await expect(observeTreasure(treasure, {
        observer: async () => injected as unknown as HubResourceSnapshot,
      })).rejects.toThrow(bodyChannel.message);
    }

    const objectRevision = snapshotFor(treasure) as unknown as {
      resource: { revision: unknown };
    };
    objectRevision.resource.revision = {
      toString: () => treasure.revision,
      raw_instance_body: "payload",
    };
    await expect(observeTreasure(treasure, {
      observer: async () => objectRevision as unknown as HubResourceSnapshot,
    })).rejects.toThrow("invalid revision");

    for (const property of ["string", "symbol"] as const) {
      const tagged = snapshotFor(treasure);
      if (!tagged.resource.tags) tagged.resource.tags = ["language:en"];
      if (property === "string") {
        Object.defineProperty(tagged.resource.tags, "instance_body", {
          value: "payload",
          enumerable: false,
        });
      } else {
        (tagged.resource.tags as unknown as Record<symbol, unknown>)[Symbol("body")] =
          "payload";
      }
      await expect(observeTreasure(treasure, {
        observer: async () => tagged,
      })).rejects.toThrow("observed resource tags must be a dense data-only array");
    }
  });
});

function snapshotFor(
  treasure: DatasetTreasure,
  counts: { downloads?: number; likes?: number } = {},
): HubResourceSnapshot {
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
      downloads: counts.downloads ?? treasure.hub_observation.downloads,
      likes: counts.likes ?? treasure.hub_observation.likes,
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
