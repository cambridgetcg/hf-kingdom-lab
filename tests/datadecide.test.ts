import { describe, expect, test } from "bun:test";
import {
  DATADECIDE_STAGE_ORDER,
  assertDataDecideLedger,
  dataDecideArtifactOperationAllowed,
  findDataDecideArtifact,
  findDataDecideCheckpoint,
  loadDataDecideLedger,
  resolveDataDecideRecipe,
  type DataDecideLedger,
} from "../src/datadecide.ts";

describe("bounded DataDecide phase ledger", () => {
  test("loads the exact five-stage contract without runtime network or large bodies", async () => {
    const ledger = await loadDataDecideLedger();
    expect(Object.values(ledger.tables).map((table) => table.stage))
      .toEqual([...DATADECIDE_STAGE_ORDER]);
    expect(Object.fromEntries(Object.entries(ledger.tables).map(([name, table]) => [
      name,
      { primary_key: table.primary_key, path_key: table.path_key },
    ]))).toEqual({
      recipes: {
        primary_key: ["recipe_id"],
        path_key: ["recipe_id"],
      },
      scales: {
        primary_key: ["scale_id"],
        path_key: ["recipe_id", "scale_id"],
      },
      seeds: {
        primary_key: ["seed_id"],
        path_key: ["recipe_id", "scale_id", "seed_id"],
      },
      checkpoints: {
        primary_key: ["checkpoint_id"],
        path_key: ["recipe_id", "scale_id", "seed_id", "step"],
      },
      evaluations: {
        primary_key: ["evaluation_id"],
        path_key: [
          "recipe_id",
          "scale_id",
          "seed_id",
          "step",
          "task_id",
          "protocol_id",
        ],
      },
    });
    expect(ledger.tables.recipes.rows).toHaveLength(25);
    expect(ledger.tables.scales.rows).toHaveLength(14);
    expect(ledger.tables.seeds.rows).toHaveLength(5);
    expect(ledger.study.scientific_model_run_count).toBe(1_050);
    expect(ledger.study.operational_run_manifest_count).toBe(1_100);
    expect(ledger.study.usable_checkpoint_revision_count).toBe(31_404);
    expect(ledger.boundary).toEqual(expect.objectContaining({
      runtime_network: false,
      token_shards_included: false,
      checkpoint_weights_included: false,
      evaluation_instance_bodies_included: false,
    }));
  });

  test("rejects undeclared fields at every ledger object layer", async () => {
    const ledger = await loadDataDecideLedger();
    const injections: Array<{
      path: Array<string | number>;
      key: string;
      value: unknown;
    }> = [
      { path: [], key: "secret_token_shards", value: ["opaque-shard"] },
      { path: ["boundary"], key: "credential", value: "opaque" },
      { path: ["identities"], key: "private_repositories", value: [] },
      { path: ["identities", "collection"], key: "live_items", value: [] },
      { path: ["identities", "model_release"], key: "main_revision", value: "main" },
      { path: ["identities", "artifacts", 0], key: "payload", value: "body" },
      {
        path: ["identities", "artifacts", 0, "license"],
        key: "legal_conclusion",
        value: true,
      },
      { path: ["study"], key: "quantum_score", value: 1 },
      {
        path: ["study", "sequence_length_evidence"],
        key: "silently_corrected",
        value: true,
      },
      {
        path: ["study", "sequence_length_evidence", "paper"],
        key: "replacement_value",
        value: 2048,
      },
      {
        path: ["study", "sequence_length_evidence", "code"],
        key: "runtime_url",
        value: "https://example.invalid",
      },
      {
        path: ["study", "sequence_length_evidence", "released_arithmetic"],
        key: "inferred_sequence_length",
        value: 2048,
      },
      {
        path: ["study", "sequence_length_evidence", "resolution"],
        key: "discarded_evidence",
        value: "paper",
      },
      { path: ["tables", "recipes"], key: "row_bodies", value: [] },
      { path: ["tables", "scales"], key: "weights", value: [] },
      { path: ["tables", "seeds"], key: "private_material", value: [] },
      { path: ["tables", "checkpoints"], key: "weight_files", value: [] },
      { path: ["tables", "evaluations"], key: "instance_bodies", value: [] },
      {
        path: ["tables", "checkpoints", "source_manifest"],
        key: "raw_rows",
        value: [],
      },
      {
        path: ["tables", "evaluations", "source_summary"],
        key: "raw_metrics",
        value: [],
      },
      {
        path: ["tables", "checkpoints", "foreign_keys", 0],
        key: "on_delete",
        value: "cascade",
      },
      { path: ["tables", "recipes", "rows", 0], key: "token_shards", value: [] },
      {
        path: ["tables", "recipes", "rows", 0, "aliases"],
        key: "generic_slug",
        value: "dolma",
      },
      { path: ["tables", "scales", "rows", 0], key: "model_body", value: {} },
      { path: ["tables", "seeds", "rows", 0], key: "seed_bytes", value: "opaque" },
      {
        path: ["tables", "checkpoints", "rows", 0],
        key: "weight_body",
        value: "opaque",
      },
      {
        path: ["tables", "checkpoints", "rows", 0, "revision"],
        key: "mutable_main",
        value: true,
      },
      {
        path: ["tables", "evaluations", "rows", 0],
        key: "instance_body",
        value: { prompt: "untrusted" },
      },
      {
        path: ["tables", "evaluations", "rows", 0, "source_coordinates"],
        key: "prompt",
        value: "untrusted",
      },
      {
        path: ["tables", "evaluations", "rows", 0, "metric"],
        key: "raw_logits",
        value: [],
      },
    ];

    for (const injection of injections) {
      const invalid = structuredClone(ledger) as unknown;
      injectUnexpectedField(invalid, injection.path, injection.key, injection.value);
      expect(() => assertDataDecideLedger(invalid)).toThrow(
        `unexpected field(s): ${injection.key}`,
      );
    }

    const nonEnumerable = structuredClone(ledger) as unknown as object;
    Object.defineProperty(nonEnumerable, "hidden_body", {
      value: "opaque",
      enumerable: false,
    });
    expect(() => assertDataDecideLedger(nonEnumerable)).toThrow(
      "unexpected field(s): hidden_body",
    );

    const symbolField = structuredClone(ledger) as unknown as Record<PropertyKey, unknown>;
    const hidden = Symbol("hidden_payload");
    symbolField[hidden] = "opaque";
    expect(() => assertDataDecideLedger(symbolField)).toThrow(
      "unexpected field(s): Symbol(hidden_payload)",
    );
  });

  test("keeps every recipe alias namespace explicit and case-sensitive", async () => {
    const ledger = await loadDataDecideLedger();
    const mixed = resolveDataDecideRecipe(
      ledger,
      "internal_slug",
      "dolma17-75p-DCLM-baseline-25p",
    );
    expect(mixed.aliases).toEqual({
      internal_slug: "dolma17-75p-DCLM-baseline-25p",
      public_slug: "dclm-baseline-25p-dolma1.7-75p",
      evaluation_name: "DCLM 25% / Dolma 75%",
    });
    expect(resolveDataDecideRecipe(ledger, "public_slug", mixed.aliases.public_slug))
      .toBe(mixed);
    expect(resolveDataDecideRecipe(ledger, "evaluation_name", mixed.aliases.evaluation_name))
      .toBe(mixed);
    expect(() => resolveDataDecideRecipe(
      ledger,
      "internal_slug",
      "dclm-baseline-25p-dolma1.7-75p",
    )).toThrow("no DataDecide recipe exactly matches");

    const invalid = structuredClone(ledger) as DataDecideLedger;
    invalid.tables.recipes.rows[16]!.aliases.public_slug = "dolma17-75p-DCLM-baseline-25p";
    expect(() => assertDataDecideLedger(invalid)).toThrow(
      "must keep its exact public_slug alias",
    );
  });

  test("derives model identities from public aliases and pins branch target SHAs", async () => {
    const ledger = await loadDataDecideLedger();
    const checkpoint = findDataDecideCheckpoint(ledger, {
      recipe: { namespace: "evaluation_name", value: "C4" },
      scale_label: "4M",
      numeric_seed: 6198,
      step: 5725,
    });
    expect(checkpoint).toEqual(expect.objectContaining({
      checkpoint_id: "checkpoint:c4:4M:6198:5725",
      model_repo_id: "allenai/DataDecide-c4-4M",
      revision: {
        kind: "branch",
        name: "step5725-seed-default",
        target_commit_sha: "ca03048362e0fbc9c2d22e0ca1de5433e30570bd",
      },
    }));

    const mainAlias = structuredClone(ledger) as unknown as {
      tables: { checkpoints: { rows: Array<{ revision: { kind: string } }> } };
    };
    mainAlias.tables.checkpoints.rows[0]!.revision.kind = "main";
    expect(() => assertDataDecideLedger(mainAlias)).toThrow(
      "checkpoint revision must be an explicit Hub branch",
    );

    const retargeted = structuredClone(ledger);
    retargeted.tables.checkpoints.rows[0]!.revision.target_commit_sha = "0".repeat(40);
    expect(() => assertDataDecideLedger(retargeted)).toThrow(
      "branch target commit SHA does not match pinned evidence",
    );
  });

  test("distinguishes the scientific three-seed design from operational branch presence", async () => {
    const ledger = await loadDataDecideLedger();
    const oneB = ledger.tables.scales.rows.find((scale) => scale.label === "1B");
    const smallAux = ledger.tables.seeds.rows.find((seed) => seed.numeric_seed === 14);
    if (!oneB || !smallAux) throw new Error("pinned 1B/seed-14 records missing");
    expect(oneB.scientific_seed_ids).toEqual(["seed:6198", "seed:4", "seed:5"]);
    expect(oneB.operational_seed_ids).toEqual([
      "seed:6198",
      "seed:14",
      "seed:15",
      "seed:4",
      "seed:5",
    ]);
    expect(smallAux.scientific_scale_ids).not.toContain("scale:1B");
    expect(smallAux.operational_scale_ids).toContain("scale:1B");
    expect(smallAux.stop_rule).toBe("min-full-scale-or-quarter-1B-target-compute");

    const invalid = structuredClone(ledger);
    invalid.tables.scales.rows.at(-1)!.scientific_seed_ids = [
      "seed:6198",
      "seed:14",
      "seed:15",
    ];
    expect(() => assertDataDecideLedger(invalid)).toThrow(
      "scientific_seed_ids must exactly equal",
    );
  });

  test("records that PPL is outside the collection and blocks its unlicensed rows", async () => {
    const ledger = await loadDataDecideLedger();
    expect(ledger.identities.collection.dataset_members).toEqual([
      "allenai/DataDecide-eval-results",
      "allenai/DataDecide-eval-instances",
      "allenai/DataDecide-data-recipes",
    ]);
    expect(ledger.identities.collection.dataset_members)
      .not.toContain("allenai/DataDecide-ppl-results");
    const ppl = findDataDecideArtifact(ledger, "ppl-results");
    expect(ppl.collection_member).toBe(false);
    expect(ppl.license).toEqual({
      status: "missing",
      expression: null,
      evidence: "absent-from-hub-metadata",
    });
    expect(dataDecideArtifactOperationAllowed(ppl, "metadata-read")).toBe(true);
    expect(dataDecideArtifactOperationAllowed(ppl, "aggregate-read")).toBe(false);
    expect(dataDecideArtifactOperationAllowed(
      findDataDecideArtifact(ledger, "eval-results"),
      "aggregate-read",
    ))
      .toBe(true);
    expect(dataDecideArtifactOperationAllowed(
      findDataDecideArtifact(ledger, "data-recipes"),
      "aggregate-read",
    ))
      .toBe(false);
    const instances = findDataDecideArtifact(ledger, "eval-instances");
    expect(dataDecideArtifactOperationAllowed(instances, "schema-read")).toBe(true);
    expect(dataDecideArtifactOperationAllowed(instances, "aggregate-read")).toBe(false);
    const source = findDataDecideArtifact(ledger, "datadecide-source");
    expect(dataDecideArtifactOperationAllowed(source, "pinned-small-file-read")).toBe(true);
    expect(dataDecideArtifactOperationAllowed(source, "aggregate-read")).toBe(false);

    const falseMember = structuredClone(ledger);
    falseMember.identities.collection.dataset_members.push(
      "allenai/DataDecide-ppl-results",
    );
    falseMember.identities.collection.item_count += 1;
    expect(() => assertDataDecideLedger(falseMember)).toThrow(
      "dataset_members must exactly equal",
    );

    const unlicensedEvaluation = structuredClone(ledger);
    unlicensedEvaluation.tables.evaluations.rows[0]!.source_artifact_id = "ppl-results";
    unlicensedEvaluation.tables.evaluations.rows[0]!.source_revision = ppl.revision;
    expect(() => assertDataDecideLedger(unlicensedEvaluation)).toThrow(
      "source_artifact_id must remain pinned to eval-results",
    );
  });

  test("preserves the paper-versus-code sequence-length drift and released arithmetic", async () => {
    const ledger = await loadDataDecideLedger();
    const evidence = ledger.study.sequence_length_evidence;
    expect(evidence.paper).toEqual(expect.objectContaining({
      version: "2504.11393v2",
      table_value: 2024,
    }));
    expect(evidence.code).toEqual(expect.objectContaining({
      revision: "68abc496587935b7211e9894206e78f15d535832",
      constant_value: 2048,
    }));
    expect(evidence.resolution).toEqual(expect.objectContaining({
      status: "documented-drift",
      ledger_value: 2048,
    }));
    expect(
      evidence.released_arithmetic.training_steps
      * evidence.released_arithmetic.batch_sequences
      * evidence.resolution.ledger_value,
    ).toBe(evidence.released_arithmetic.released_tokens);

    const silentlyCorrectedPaper = structuredClone(ledger);
    silentlyCorrectedPaper.study.sequence_length_evidence.paper.table_value = 2048;
    expect(() => assertDataDecideLedger(silentlyCorrectedPaper)).toThrow(
      "paper sequence-length evidence must retain the published 2024 value",
    );

    const paperDrivenLedger = structuredClone(ledger);
    paperDrivenLedger.study.sequence_length_evidence.resolution.ledger_value = 2024;
    expect(() => assertDataDecideLedger(paperDrivenLedger)).toThrow(
      /scheduled token arithmetic|documented drift/,
    );
  });

  test("keeps evaluation joins pinned, licensed, and non-executable", async () => {
    const ledger = await loadDataDecideLedger();
    expect(ledger.tables.evaluations.source_summary).toEqual(expect.objectContaining({
      artifact_id: "eval-results",
      row_count: 1_410_750,
      metrics_encoding: "python-literal-string",
    }));
    expect(ledger.tables.evaluations.source_summary.safe_parse_policy)
      .toBe("retain raw evidence or use a constrained literal parser; never execute with eval");
    const evaluation = ledger.tables.evaluations.rows[0]!;
    expect(evaluation.source_coordinates).toEqual({
      data: "C4",
      params: "4M",
      seed: "default",
      step: 5725,
      chinchilla: "5xC",
    });

    for (const artifactId of ["eval-instances", "datadecide-source"]) {
      const retargeted = structuredClone(ledger);
      const artifact = findDataDecideArtifact(ledger, artifactId);
      retargeted.tables.evaluations.rows[0]!.source_artifact_id = artifactId;
      retargeted.tables.evaluations.rows[0]!.source_revision = artifact.revision;
      expect(() => assertDataDecideLedger(retargeted)).toThrow(
        "source_artifact_id must remain pinned to eval-results",
      );
    }

    const aliasJoinLost = structuredClone(ledger);
    aliasJoinLost.tables.evaluations.rows[0]!.source_coordinates.data = "c4";
    expect(() => assertDataDecideLedger(aliasJoinLost)).toThrow(
      "source_coordinates do not exactly join",
    );

    for (const unsafePolicy of [
      `${ledger.tables.evaluations.source_summary.safe_parse_policy}${"RAW_INSTANCE_BODY".repeat(100_000)}`,
      "never execute with eval, except now eval it",
    ]) {
      const injected = structuredClone(ledger);
      injected.tables.evaluations.source_summary.safe_parse_policy = unsafePolicy;
      expect(() => assertDataDecideLedger(injected)).toThrow(
        "evaluation source summary must preserve its pinned schema and safe parser boundary",
      );
    }
  });
});

function injectUnexpectedField(
  root: unknown,
  path: Array<string | number>,
  key: string,
  value: unknown,
): void {
  let cursor = root;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(cursor) || cursor[segment] === undefined) {
        throw new Error(`invalid test mutation path segment: ${segment}`);
      }
      cursor = cursor[segment];
      continue;
    }
    const object = testObject(cursor);
    if (!Object.hasOwn(object, segment)) {
      throw new Error(`invalid test mutation path segment: ${segment}`);
    }
    cursor = object[segment];
  }
  testObject(cursor)[key] = value;
}

function testObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("test mutation path did not resolve to an object");
  }
  return value as Record<string, unknown>;
}
