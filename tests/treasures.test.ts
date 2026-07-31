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
    const observed = await observeTreasure(treasure, {
      observer: async () => snapshot,
      now: () => new Date("2026-07-31T19:00:00.000Z"),
    });
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
