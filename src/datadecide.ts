import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const DATADECIDE_STAGE_ORDER = [
  "recipe",
  "scale",
  "seed",
  "checkpoint",
  "evaluation",
] as const;

export const DATADECIDE_RECIPE_ALIAS_NAMESPACES = [
  "internal_slug",
  "public_slug",
  "evaluation_name",
] as const;

export type DataDecideStage = (typeof DATADECIDE_STAGE_ORDER)[number];
export type DataDecideRecipeAliasNamespace =
  (typeof DATADECIDE_RECIPE_ALIAS_NAMESPACES)[number];
export type DataDecideCoverage = "complete" | "bounded-witnesses";
export type DataDecideLicenseStatus = "declared" | "missing";
export type DataDecideContentRoute =
  | "metadata-only"
  | "pinned-small-file"
  | "bounded-aggregate"
  | "bounded-schema";
export type DataDecideArtifactOperation =
  | "metadata-read"
  | "schema-read"
  | "aggregate-read"
  | "pinned-small-file-read";

export interface DataDecideLicense {
  status: DataDecideLicenseStatus;
  expression: string | null;
  evidence: "repository-license" | "hub-metadata" | "absent-from-hub-metadata";
}

export interface DataDecideArtifact {
  artifact_id: string;
  kind: "github-repository" | "github-file" | "huggingface-dataset";
  repo_id: string;
  canonical_url: string;
  revision: string;
  path?: string;
  blob_sha?: string;
  collection_member: boolean;
  license: DataDecideLicense;
  content_route: DataDecideContentRoute;
}

export interface DataDecideForeignKey {
  fields: string[];
  references_table: keyof DataDecideTables;
  references_fields: string[];
}

export interface DataDecideTable<Row> {
  stage: DataDecideStage;
  coverage: DataDecideCoverage;
  primary_key: string[];
  path_key: string[];
  foreign_keys: DataDecideForeignKey[];
  rows: Row[];
}

export interface DataDecideRecipe {
  recipe_id: string;
  aliases: Record<DataDecideRecipeAliasNamespace, string>;
}

export interface DataDecideScale {
  scale_id: string;
  label: string;
  non_embedding_parameters: number;
  batch_sequences: number;
  scheduled_full_steps: number;
  scheduled_full_tokens: number;
  hidden_size: number;
  attention_heads: number;
  layers: number;
  learning_rate: number;
  scientific_seed_ids: string[];
  operational_seed_ids: string[];
}

export interface DataDecideSeed {
  seed_id: string;
  numeric_seed: number;
  evaluation_alias: string;
  branch_alias: string;
  scientific_scale_ids: string[];
  operational_scale_ids: string[];
  stop_rule:
    | "full-scale-schedule"
    | "min-full-scale-or-quarter-1B-target-compute";
}

export interface DataDecideCheckpoint {
  checkpoint_id: string;
  recipe_id: string;
  scale_id: string;
  seed_id: string;
  step: number;
  tokens: number;
  compute_flops: string;
  model_repo_id: string;
  revision: {
    kind: "branch";
    name: string;
    target_commit_sha: string;
  };
}

export interface DataDecideEvaluation {
  evaluation_id: string;
  checkpoint_id: string;
  task_id: string;
  protocol_id: string;
  source_artifact_id: string;
  source_revision: string;
  source_coordinates: {
    data: string;
    params: string;
    seed: string;
    step: number;
    chinchilla: "5xC";
  };
  metric: {
    name: string;
    selected_source_metric: string;
    value: number;
  };
}

export interface DataDecideTables {
  recipes: DataDecideTable<DataDecideRecipe>;
  scales: DataDecideTable<DataDecideScale>;
  seeds: DataDecideTable<DataDecideSeed>;
  checkpoints: DataDecideTable<DataDecideCheckpoint> & {
    source_manifest: {
      artifact_id: string;
      path: string;
      raw_run_rows: number;
      excluded_legacy_rows: number;
      usable_run_rows: number;
      usable_checkpoint_revisions: number;
    };
  };
  evaluations: DataDecideTable<DataDecideEvaluation> & {
    source_summary: {
      artifact_id: string;
      config: string;
      split: string;
      row_count: number;
      metrics_encoding: string;
      safe_parse_policy: string;
    };
  };
}

export interface DataDecideLedger {
  protocol: "hf-kingdom-datadecide-ledger/v1";
  observed_at: string;
  purpose: string;
  boundary: {
    static_pinned_evidence: true;
    runtime_network: false;
    token_shards_included: false;
    checkpoint_weights_included: false;
    evaluation_instance_bodies_included: false;
    bounded_aggregate_witnesses_included: true;
    publisher_metadata_is_evidence_not_authority: true;
    license_metadata_is_not_legal_advice: true;
  };
  identities: {
    collection: {
      collection_id: string;
      canonical_url: string;
      item_count: number;
      dataset_members: string[];
      model_member_count: number;
      paper_members: string[];
    };
    model_release: {
      owner: string;
      repo_pattern: string;
      repo_count: number;
      complete_recipe_scale_cartesian_product: true;
      license_expression: string;
    };
    artifacts: DataDecideArtifact[];
  };
  study: {
    recipe_count: number;
    scale_count: number;
    scientific_seeds_per_recipe_scale: number;
    scientific_model_run_count: number;
    operational_run_manifest_count: number;
    usable_checkpoint_revision_count: number;
    token_parameter_ratio: number;
    chinchilla_multiple: string;
    non_target_auxiliary_stop_rule: string;
    sequence_length_evidence: {
      paper: {
        version: string;
        table_value: number;
        source: string;
      };
      code: {
        revision: string;
        constant_value: number;
        source: string;
      };
      released_arithmetic: {
        scale_id: string;
        training_steps: number;
        batch_sequences: number;
        released_tokens: number;
      };
      resolution: {
        status: "documented-drift";
        ledger_value: number;
        reason: string;
      };
    };
  };
  tables: DataDecideTables;
}

export interface FindDataDecideCheckpointOptions {
  recipe: {
    namespace: DataDecideRecipeAliasNamespace;
    value: string;
  };
  scale_label: string;
  numeric_seed: number;
  step: number;
}

export const DEFAULT_DATADECIDE_LEDGER_PATH = resolve(
  import.meta.dir,
  "..",
  "data",
  "datadecide-ledger.v1.json",
);

const SHA40 = /^[0-9a-f]{40}$/;
const EVALUATION_SAFE_PARSE_POLICY =
  "retain raw evidence or use a constrained literal parser; never execute with eval";
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const DECIMAL_INTEGER = /^(?:0|[1-9]\d*)$/;
const SCALE_IDS = [
  "scale:4M",
  "scale:6M",
  "scale:8M",
  "scale:10M",
  "scale:14M",
  "scale:16M",
  "scale:20M",
  "scale:60M",
  "scale:90M",
  "scale:150M",
  "scale:300M",
  "scale:530M",
  "scale:750M",
  "scale:1B",
] as const;
const NON_TARGET_SCALE_IDS = SCALE_IDS.slice(0, -1);

const EXPECTED_RECIPE_ALIASES = [
  ["dolma17", "dolma1_7", "Dolma1.7"],
  ["no_code", "dolma1_7-no-code", "Dolma1.7 (no code)"],
  ["no_math_no_code", "dolma1_7-no-math-code", "Dolma1.7 (no math, code)"],
  ["no_reddit", "dolma1_7-no-reddit", "Dolma1.7 (no Reddit)"],
  ["no_flan", "dolma1_7-no-flan", "Dolma1.7 (no Flan)"],
  ["dolma-v1-6-and-sources-baseline", "dolma1_6plus", "Dolma1.6++"],
  ["c4", "c4", "C4"],
  ["prox_fineweb_pro", "fineweb-pro", "FineWeb-Pro"],
  ["fineweb_edu_dedup", "fineweb-edu", "FineWeb-Edu"],
  ["falcon", "falcon", "Falcon"],
  ["falcon_and_cc", "falcon-and-cc", "Falcon+CC"],
  ["falcon_and_cc_eli5_oh_top10p", "falcon-and-cc-qc-10p", "Falcon+CC (QC 10%)"],
  ["falcon_and_cc_eli5_oh_top20p", "falcon-and-cc-qc-20p", "Falcon+CC (QC 20%)"],
  ["falcon_and_cc_og_eli5_oh_top10p", "falcon-and-cc-qc-orig-10p", "Falcon+CC (QC Orig 10%)"],
  ["falcon_and_cc_tulu_qc_top10", "falcon-and-cc-qc-tulu-10p", "Falcon+CC (QC Tulu 10%)"],
  ["DCLM-baseline", "dclm-baseline", "DCLM-Baseline"],
  ["dolma17-75p-DCLM-baseline-25p", "dclm-baseline-25p-dolma1.7-75p", "DCLM 25% / Dolma 75%"],
  ["dolma17-50p-DCLM-baseline-50p", "dclm-baseline-50p-dolma1.7-50p", "DCLM 50% / Dolma 50%"],
  ["dolma17-25p-DCLM-baseline-75p", "dclm-baseline-75p-dolma1.7-25p", "DCLM 75% / Dolma 25%"],
  ["dclm_ft7percentile_fw2", "dclm-baseline-qc-7p-fw2", "DCLM (QC 7%, FW2)"],
  ["dclm_ft7percentile_fw3", "dclm-baseline-qc-7p-fw3", "DCLM (QC 7%, FW3)"],
  ["dclm_fw_top10", "dclm-baseline-qc-fw-10p", "DCLM (QC FW 10%)"],
  ["dclm_fw_top3", "dclm-baseline-qc-fw-3p", "DCLM (QC FW 3%)"],
  ["pos_eli5_oh_neg_dclm_refinedweb_steps_2000_lr3e4_top10p", "dclm-baseline-qc-10p", "DCLM (QC 10%)"],
  ["pos_eli5_oh_neg_dclm_refinedweb_steps_2000_lr3e4_top20p", "dclm-baseline-qc-20p", "DCLM (QC 20%)"],
] as const;

const EXPECTED_SCALE_VALUES = [
  ["4M", 3_744_832, 32, 5_725, 375_193_600, 64, 8, 8, 0.014],
  ["6M", 6_010_464, 32, 9_182, 601_751_552, 96, 8, 8, 0.012],
  ["8M", 8_538_240, 32, 13_039, 854_523_904, 128, 8, 8, 0.011],
  ["10M", 9_900_432, 32, 15_117, 990_707_712, 144, 8, 8, 0.01],
  ["14M", 14_380_224, 32, 21_953, 1_438_711_808, 192, 8, 8, 0.0092],
  ["16M", 16_004_560, 32, 24_432, 1_601_175_552, 208, 8, 8, 0.0089],
  ["20M", 19_101_888, 64, 14_584, 1_911_554_048, 192, 8, 16, 0.0084],
  ["60M", 57_078_144, 96, 29_042, 5_709_889_536, 384, 12, 16, 0.0058],
  ["90M", 97_946_640, 160, 29_901, 9_797_959_680, 528, 12, 16, 0.0049],
  ["150M", 151_898_880, 192, 38_157, 15_003_942_912, 768, 12, 12, 0.0042],
  ["300M", 319_980_544, 320, 45_787, 30_006_968_320, 1_024, 16, 16, 0.0033],
  ["530M", 530_074_944, 448, 57_786, 53_018_886_144, 1_344, 16, 16, 0.0028],
  ["750M", 681_297_408, 576, 63_589, 75_012_636_672, 1_536, 16, 16, 0.0025],
  ["1B", 1_176_832_000, 704, 69_369, 100_015_669_248, 2_048, 16, 16, 0.0021],
] as const;

const EXPECTED_ARTIFACTS = {
  "datadecide-source": {
    kind: "github-repository",
    repo_id: "allenai/DataDecide",
    canonical_url: "https://github.com/allenai/DataDecide",
    revision: "68abc496587935b7211e9894206e78f15d535832",
    collection_member: false,
    license_status: "declared",
    license_expression: "Apache-2.0",
    license_evidence: "repository-license",
    content_route: "pinned-small-file",
  },
  "olmo-recipe-manifest": {
    kind: "github-file",
    repo_id: "allenai/OLMo",
    canonical_url: "https://github.com/allenai/OLMo/blob/7094aab0448096f4994cae881edbd629d6c2f3de/olmo/data/named_data_mixes.py",
    revision: "7094aab0448096f4994cae881edbd629d6c2f3de",
    path: "olmo/data/named_data_mixes.py",
    blob_sha: "3db799996c952a14b32efb9ff67488f7100f1b2a",
    collection_member: false,
    license_status: "declared",
    license_expression: "Apache-2.0",
    license_evidence: "repository-license",
    content_route: "pinned-small-file",
  },
  "data-recipes": {
    kind: "huggingface-dataset",
    repo_id: "allenai/DataDecide-data-recipes",
    canonical_url: "https://huggingface.co/datasets/allenai/DataDecide-data-recipes",
    revision: "3baf34baf5b636f0943401b5c6a2ccb7e5cf3bb9",
    collection_member: true,
    license_status: "declared",
    license_expression: "ODC-By-1.0",
    license_evidence: "hub-metadata",
    content_route: "metadata-only",
  },
  "eval-results": {
    kind: "huggingface-dataset",
    repo_id: "allenai/DataDecide-eval-results",
    canonical_url: "https://huggingface.co/datasets/allenai/DataDecide-eval-results",
    revision: "9919b5a0e61e57a85021263918fa82d6ceaee038",
    collection_member: true,
    license_status: "declared",
    license_expression: "ODC-By-1.0",
    license_evidence: "hub-metadata",
    content_route: "bounded-aggregate",
  },
  "eval-instances": {
    kind: "huggingface-dataset",
    repo_id: "allenai/DataDecide-eval-instances",
    canonical_url: "https://huggingface.co/datasets/allenai/DataDecide-eval-instances",
    revision: "23f3b2e186ca6c39026e3efa00e4af397680c075",
    collection_member: true,
    license_status: "declared",
    license_expression: "ODC-By-1.0",
    license_evidence: "hub-metadata",
    content_route: "bounded-schema",
  },
  "ppl-results": {
    kind: "huggingface-dataset",
    repo_id: "allenai/DataDecide-ppl-results",
    canonical_url: "https://huggingface.co/datasets/allenai/DataDecide-ppl-results",
    revision: "c4a9fa360a0c8351e71f3ede04dd165995fab68c",
    collection_member: false,
    license_status: "missing",
    license_expression: null,
    license_evidence: "absent-from-hub-metadata",
    content_route: "metadata-only",
  },
} as const;

const EXPECTED_TABLE_CONTRACTS = {
  recipes: {
    stage: "recipe",
    coverage: "complete",
    primary_key: ["recipe_id"],
    path_key: ["recipe_id"],
    foreign_keys: [],
  },
  scales: {
    stage: "scale",
    coverage: "complete",
    primary_key: ["scale_id"],
    path_key: ["recipe_id", "scale_id"],
    foreign_keys: [],
  },
  seeds: {
    stage: "seed",
    coverage: "complete",
    primary_key: ["seed_id"],
    path_key: ["recipe_id", "scale_id", "seed_id"],
    foreign_keys: [],
  },
  checkpoints: {
    stage: "checkpoint",
    coverage: "bounded-witnesses",
    primary_key: ["checkpoint_id"],
    path_key: ["recipe_id", "scale_id", "seed_id", "step"],
    foreign_keys: [
      { fields: ["recipe_id"], references_table: "recipes", references_fields: ["recipe_id"] },
      { fields: ["scale_id"], references_table: "scales", references_fields: ["scale_id"] },
      { fields: ["seed_id"], references_table: "seeds", references_fields: ["seed_id"] },
    ],
  },
  evaluations: {
    stage: "evaluation",
    coverage: "bounded-witnesses",
    primary_key: ["evaluation_id"],
    path_key: ["recipe_id", "scale_id", "seed_id", "step", "task_id", "protocol_id"],
    foreign_keys: [
      { fields: ["checkpoint_id"], references_table: "checkpoints", references_fields: ["checkpoint_id"] },
    ],
  },
} as const;

const EXPECTED_CHECKPOINT_TARGETS = new Map([
  ["checkpoint:c4:4M:6198:5725", "ca03048362e0fbc9c2d22e0ca1de5433e30570bd"],
  ["checkpoint:c4:4M:15:5725", "00153e25a853f47f660ce603753db59281e491bb"],
  ["checkpoint:dolma17:1B:6198:69369", "c880c1565f57c13eab7e41d53fe3351be2ef38a9"],
  ["checkpoint:dolma17:1B:4:69369", "404b8ab1e836f782e087cbf663c8db94e64b7fe6"],
  ["checkpoint:dolma17:1B:5:69369", "1cf8f2d99f9f244c90bc941326adf84150d3c15d"],
]);

const EXPECTED_EVALUATIONS = new Map([
  [
    "evaluation:c4:4M:6198:5725:arc_challenge:olmes-cf-all-items",
    {
      task: "arc_challenge",
      source_artifact_id: "eval-results",
      source_revision: "9919b5a0e61e57a85021263918fa82d6ceaee038",
      source_metric: "acc_uncond",
      value: 0.21843003412969283,
    },
  ],
  [
    "evaluation:c4:4M:6198:5725:arc_easy:olmes-cf-all-items",
    {
      task: "arc_easy",
      source_artifact_id: "eval-results",
      source_revision: "9919b5a0e61e57a85021263918fa82d6ceaee038",
      source_metric: "acc_per_char",
      value: 0.29713804713804715,
    },
  ],
]);

export async function loadDataDecideLedger(
  path = DEFAULT_DATADECIDE_LEDGER_PATH,
): Promise<DataDecideLedger> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  assertDataDecideLedger(raw);
  return raw;
}

export function assertDataDecideLedger(
  value: unknown,
): asserts value is DataDecideLedger {
  const ledger = objectValue(value, "ledger");
  exactObjectKeys(
    ledger,
    ["protocol", "observed_at", "purpose", "boundary", "identities", "study", "tables"],
    "ledger",
  );
  if (ledger.protocol !== "hf-kingdom-datadecide-ledger/v1") {
    throw new TypeError("ledger protocol must be hf-kingdom-datadecide-ledger/v1");
  }
  isoInstant(ledger.observed_at, "ledger.observed_at");
  nonemptyString(ledger.purpose, "ledger.purpose");
  assertBoundary(ledger.boundary);

  const identities = objectValue(ledger.identities, "ledger.identities");
  exactObjectKeys(
    identities,
    ["collection", "model_release", "artifacts"],
    "ledger.identities",
  );
  const collection = assertCollection(identities.collection);
  assertModelRelease(identities.model_release);
  const artifacts = assertArtifacts(identities.artifacts, collection.dataset_members);
  const study = assertStudy(ledger.study);
  const tables = objectValue(ledger.tables, "ledger.tables");
  assertFiveTableContracts(tables);

  const recipes = assertRecipes(tableRows(tables, "recipes"), study.recipe_count);
  const scales = assertScales(tableRows(tables, "scales"), study.scale_count, study);
  const seeds = assertSeeds(tableRows(tables, "seeds"), scales);
  assertScientificAndOperationalCounts(recipes, scales, study);
  const checkpoints = assertCheckpoints(
    tableRows(tables, "checkpoints"),
    recipes,
    scales,
    seeds,
    study.sequence_length_evidence.resolution.ledger_value,
  );
  assertCheckpointManifest(tables.checkpoints, study);
  assertEvaluations(
    tableRows(tables, "evaluations"),
    checkpoints,
    recipes,
    scales,
    seeds,
    artifacts,
  );
  assertEvaluationSourceSummary(tables.evaluations, artifacts);
  assertSequenceLengthDrift(study, scales, artifacts);
}

export function resolveDataDecideRecipe(
  ledger: DataDecideLedger,
  namespace: DataDecideRecipeAliasNamespace,
  value: string,
): DataDecideRecipe {
  if (!DATADECIDE_RECIPE_ALIAS_NAMESPACES.includes(namespace)) {
    throw new TypeError("recipe alias namespace must be explicit and supported");
  }
  nonemptyString(value, "recipe alias");
  const match = ledger.tables.recipes.rows.find(
    (recipe) => recipe.aliases[namespace] === value,
  );
  if (!match) {
    throw new TypeError(`no DataDecide recipe exactly matches ${namespace}: ${value}`);
  }
  return match;
}

export function findDataDecideArtifact(
  ledger: DataDecideLedger,
  artifactId: string,
): DataDecideArtifact {
  const artifact = ledger.identities.artifacts.find(
    (candidate) => candidate.artifact_id === artifactId,
  );
  if (!artifact) throw new TypeError(`unknown DataDecide artifact: ${artifactId}`);
  return artifact;
}

export function dataDecideArtifactOperationAllowed(
  artifact: DataDecideArtifact,
  operation: DataDecideArtifactOperation,
): boolean {
  if (operation === "metadata-read") return true;
  if (artifact.license.status !== "declared") return false;

  switch (artifact.content_route) {
    case "metadata-only":
      return false;
    case "pinned-small-file":
      return operation === "pinned-small-file-read";
    case "bounded-schema":
      return operation === "schema-read";
    case "bounded-aggregate":
      return operation === "schema-read" || operation === "aggregate-read";
  }
}

export function findDataDecideCheckpoint(
  ledger: DataDecideLedger,
  options: FindDataDecideCheckpointOptions,
): DataDecideCheckpoint {
  const recipe = resolveDataDecideRecipe(
    ledger,
    options.recipe.namespace,
    options.recipe.value,
  );
  const scale = ledger.tables.scales.rows.find(
    (candidate) => candidate.label === options.scale_label,
  );
  const seed = ledger.tables.seeds.rows.find(
    (candidate) => candidate.numeric_seed === options.numeric_seed,
  );
  if (!scale) throw new TypeError(`unknown DataDecide scale label: ${options.scale_label}`);
  if (!seed) throw new TypeError(`unknown DataDecide numeric seed: ${options.numeric_seed}`);
  const checkpoint = ledger.tables.checkpoints.rows.find((candidate) =>
    candidate.recipe_id === recipe.recipe_id
    && candidate.scale_id === scale.scale_id
    && candidate.seed_id === seed.seed_id
    && candidate.step === options.step
  );
  if (!checkpoint) {
    throw new TypeError("no bounded checkpoint witness exactly matches the requested path");
  }
  return checkpoint;
}

function assertBoundary(value: unknown): void {
  const boundary = objectValue(value, "ledger.boundary");
  exactObjectKeys(
    boundary,
    [
      "static_pinned_evidence",
      "runtime_network",
      "token_shards_included",
      "checkpoint_weights_included",
      "evaluation_instance_bodies_included",
      "bounded_aggregate_witnesses_included",
      "publisher_metadata_is_evidence_not_authority",
      "license_metadata_is_not_legal_advice",
    ],
    "ledger.boundary",
  );
  for (const key of [
    "static_pinned_evidence",
    "bounded_aggregate_witnesses_included",
    "publisher_metadata_is_evidence_not_authority",
    "license_metadata_is_not_legal_advice",
  ]) {
    if (boundary[key] !== true) throw new TypeError(`ledger.boundary.${key} must be true`);
  }
  for (const key of [
    "runtime_network",
    "token_shards_included",
    "checkpoint_weights_included",
    "evaluation_instance_bodies_included",
  ]) {
    if (boundary[key] !== false) throw new TypeError(`ledger.boundary.${key} must be false`);
  }
}

function assertCollection(value: unknown): DataDecideLedger["identities"]["collection"] {
  const collection = objectValue(value, "ledger.identities.collection");
  exactObjectKeys(
    collection,
    [
      "collection_id",
      "canonical_url",
      "item_count",
      "dataset_members",
      "model_member_count",
      "paper_members",
    ],
    "ledger.identities.collection",
  );
  if (collection.collection_id !== "allenai/datadecide-67edb1d2bacba40b5d3ed633") {
    throw new TypeError("DataDecide collection id must exactly match the pinned collection");
  }
  if (
    collection.canonical_url
    !== "https://huggingface.co/collections/allenai/datadecide-67edb1d2bacba40b5d3ed633"
  ) {
    throw new TypeError("DataDecide collection URL must exactly match its canonical slug");
  }
  const datasetMembers = exactStringArray(
    collection.dataset_members,
    [
      "allenai/DataDecide-eval-results",
      "allenai/DataDecide-eval-instances",
      "allenai/DataDecide-data-recipes",
    ],
    "ledger.identities.collection.dataset_members",
  );
  if (datasetMembers.includes("allenai/DataDecide-ppl-results")) {
    throw new TypeError("DataDecide PPL results are not a member of the pinned collection");
  }
  if (collection.item_count !== 354 || collection.model_member_count !== 350) {
    throw new TypeError("DataDecide collection counts must remain pinned at 354 items and 350 models");
  }
  const papers = exactStringArray(
    collection.paper_members,
    ["2504.11393"],
    "ledger.identities.collection.paper_members",
  );
  if (collection.item_count !== datasetMembers.length + collection.model_member_count + papers.length) {
    throw new TypeError("DataDecide collection item count does not reconcile");
  }
  return collection as unknown as DataDecideLedger["identities"]["collection"];
}

function assertModelRelease(value: unknown): void {
  const release = objectValue(value, "ledger.identities.model_release");
  exactObjectKeys(
    release,
    [
      "owner",
      "repo_pattern",
      "repo_count",
      "complete_recipe_scale_cartesian_product",
      "license_expression",
    ],
    "ledger.identities.model_release",
  );
  if (
    release.owner !== "allenai"
    || release.repo_pattern !== "allenai/DataDecide-{public_recipe_slug}-{scale_label}"
    || release.repo_count !== 350
    || release.complete_recipe_scale_cartesian_product !== true
    || release.license_expression !== "Apache-2.0"
  ) {
    throw new TypeError("DataDecide model release identity must remain exact and pinned");
  }
}

function assertArtifacts(
  value: unknown,
  collectionMembers: string[],
): Map<string, DataDecideArtifact> {
  if (!Array.isArray(value) || value.length !== Object.keys(EXPECTED_ARTIFACTS).length) {
    throw new TypeError("ledger.identities.artifacts must contain the six pinned artifacts");
  }
  const byId = new Map<string, DataDecideArtifact>();
  for (const [index, rawArtifact] of value.entries()) {
    const label = `ledger.identities.artifacts[${index}]`;
    const artifact = objectValue(rawArtifact, label);
    const artifactId = nonemptyString(artifact.artifact_id, `${label}.artifact_id`);
    if (byId.has(artifactId)) throw new TypeError(`duplicate DataDecide artifact id: ${artifactId}`);
    const expected = EXPECTED_ARTIFACTS[artifactId as keyof typeof EXPECTED_ARTIFACTS];
    if (!expected) throw new TypeError(`unexpected DataDecide artifact id: ${artifactId}`);
    exactObjectKeys(
      artifact,
      [
        "artifact_id",
        "kind",
        "repo_id",
        "canonical_url",
        "revision",
        ...(expected.kind === "github-file" ? ["path", "blob_sha"] : []),
        "collection_member",
        "license",
        "content_route",
      ],
      label,
    );
    for (const key of ["kind", "repo_id", "canonical_url", "revision", "collection_member", "content_route"] as const) {
      if (artifact[key] !== expected[key]) {
        throw new TypeError(`${label}.${key} does not match the pinned artifact identity`);
      }
    }
    sha40(artifact.revision, `${label}.revision`);
    if ("path" in expected && artifact.path !== expected.path) {
      throw new TypeError(`${label}.path does not match the pinned file identity`);
    }
    if ("blob_sha" in expected) {
      if (artifact.blob_sha !== expected.blob_sha) {
        throw new TypeError(`${label}.blob_sha does not match the pinned file identity`);
      }
      sha40(artifact.blob_sha, `${label}.blob_sha`);
    }
    const license = objectValue(artifact.license, `${label}.license`);
    exactObjectKeys(
      license,
      ["status", "expression", "evidence"],
      `${label}.license`,
    );
    if (
      license.status !== expected.license_status
      || license.expression !== expected.license_expression
      || license.evidence !== expected.license_evidence
    ) {
      throw new TypeError(`${label}.license does not match the observed publisher metadata`);
    }
    if (license.status === "missing") {
      if (license.expression !== null || artifact.content_route !== "metadata-only") {
        throw new TypeError(`${label} cannot route missing-licence content beyond metadata`);
      }
    } else {
      nonemptyString(license.expression, `${label}.license.expression`);
    }
    const typed = artifact as unknown as DataDecideArtifact;
    byId.set(artifactId, typed);
  }

  const memberArtifacts = [...byId.values()]
    .filter((artifact) => artifact.collection_member && artifact.kind === "huggingface-dataset")
    .map((artifact) => artifact.repo_id);
  if (
    memberArtifacts.length !== collectionMembers.length
    || memberArtifacts.some((repoId) => !collectionMembers.includes(repoId))
  ) {
    throw new TypeError("artifact collection membership must match the pinned three datasets");
  }
  const ppl = byId.get("ppl-results");
  if (!ppl || ppl.collection_member || ppl.license.status !== "missing") {
    throw new TypeError("PPL results must remain collection-omitted and licence-gated");
  }
  return byId;
}

function assertStudy(value: unknown): DataDecideLedger["study"] {
  const study = objectValue(value, "ledger.study");
  exactObjectKeys(
    study,
    [
      "recipe_count",
      "scale_count",
      "scientific_seeds_per_recipe_scale",
      "scientific_model_run_count",
      "operational_run_manifest_count",
      "usable_checkpoint_revision_count",
      "token_parameter_ratio",
      "chinchilla_multiple",
      "non_target_auxiliary_stop_rule",
      "sequence_length_evidence",
    ],
    "ledger.study",
  );
  const exactNumbers = {
    recipe_count: 25,
    scale_count: 14,
    scientific_seeds_per_recipe_scale: 3,
    scientific_model_run_count: 1050,
    operational_run_manifest_count: 1100,
    usable_checkpoint_revision_count: 31404,
    token_parameter_ratio: 100,
  } as const;
  for (const [key, expected] of Object.entries(exactNumbers)) {
    if (study[key] !== expected) throw new TypeError(`ledger.study.${key} must equal ${expected}`);
  }
  if (
    study.chinchilla_multiple !== "5xC"
    || study.non_target_auxiliary_stop_rule
      !== "min(full scale schedule, 25% of the 1B target compute budget)"
  ) {
    throw new TypeError("DataDecide compute schedule identity must remain pinned");
  }
  const sequence = objectValue(
    study.sequence_length_evidence,
    "ledger.study.sequence_length_evidence",
  );
  exactObjectKeys(
    sequence,
    ["paper", "code", "released_arithmetic", "resolution"],
    "ledger.study.sequence_length_evidence",
  );
  const paper = objectValue(sequence.paper, "ledger.study.sequence_length_evidence.paper");
  exactObjectKeys(
    paper,
    ["version", "table_value", "source"],
    "ledger.study.sequence_length_evidence.paper",
  );
  const code = objectValue(sequence.code, "ledger.study.sequence_length_evidence.code");
  exactObjectKeys(
    code,
    ["revision", "constant_value", "source"],
    "ledger.study.sequence_length_evidence.code",
  );
  const releasedArithmetic = objectValue(
    sequence.released_arithmetic,
    "ledger.study.sequence_length_evidence.released_arithmetic",
  );
  exactObjectKeys(
    releasedArithmetic,
    ["scale_id", "training_steps", "batch_sequences", "released_tokens"],
    "ledger.study.sequence_length_evidence.released_arithmetic",
  );
  const resolution = objectValue(
    sequence.resolution,
    "ledger.study.sequence_length_evidence.resolution",
  );
  exactObjectKeys(
    resolution,
    ["status", "ledger_value", "reason"],
    "ledger.study.sequence_length_evidence.resolution",
  );
  return study as unknown as DataDecideLedger["study"];
}

function assertFiveTableContracts(tables: Record<string, unknown>): void {
  const tableNames = Object.keys(EXPECTED_TABLE_CONTRACTS);
  exactObjectKeys(tables, tableNames, "ledger.tables");
  if (!sameStringArray(Object.keys(tables), tableNames)) {
    throw new TypeError("ledger must expose exactly five ordered stage tables");
  }
  for (const tableName of tableNames) {
    const label = `ledger.tables.${tableName}`;
    const table = objectValue(tables[tableName], label);
    exactObjectKeys(
      table,
      [
        "stage",
        "coverage",
        "primary_key",
        "path_key",
        "foreign_keys",
        ...(tableName === "checkpoints" ? ["source_manifest"] : []),
        ...(tableName === "evaluations" ? ["source_summary"] : []),
        "rows",
      ],
      label,
    );
    const expected = EXPECTED_TABLE_CONTRACTS[tableName as keyof typeof EXPECTED_TABLE_CONTRACTS];
    if (table.stage !== expected.stage || table.coverage !== expected.coverage) {
      throw new TypeError(`ledger.tables.${tableName} stage/coverage contract changed`);
    }
    exactStringArray(table.primary_key, [...expected.primary_key], `ledger.tables.${tableName}.primary_key`);
    exactStringArray(table.path_key, [...expected.path_key], `ledger.tables.${tableName}.path_key`);
    if (!Array.isArray(table.foreign_keys)) {
      throw new TypeError(`ledger.tables.${tableName}.foreign_keys must be an array`);
    }
    for (const [index, rawForeignKey] of table.foreign_keys.entries()) {
      const foreignKey = objectValue(
        rawForeignKey,
        `ledger.tables.${tableName}.foreign_keys[${index}]`,
      );
      exactObjectKeys(
        foreignKey,
        ["fields", "references_table", "references_fields"],
        `ledger.tables.${tableName}.foreign_keys[${index}]`,
      );
    }
    if (JSON.stringify(table.foreign_keys) !== JSON.stringify(expected.foreign_keys)) {
      throw new TypeError(`ledger.tables.${tableName}.foreign_keys changed`);
    }
    if (!Array.isArray(table.rows)) throw new TypeError(`ledger.tables.${tableName}.rows must be an array`);
  }
}

function assertRecipes(value: unknown[], expectedCount: number): Map<string, DataDecideRecipe> {
  if (value.length !== expectedCount || value.length !== EXPECTED_RECIPE_ALIASES.length) {
    throw new TypeError("DataDecide recipe table must contain all 25 recipes");
  }
  const byId = new Map<string, DataDecideRecipe>();
  const aliasSets = new Map<DataDecideRecipeAliasNamespace, Set<string>>(
    DATADECIDE_RECIPE_ALIAS_NAMESPACES.map((namespace) => [namespace, new Set()]),
  );
  for (const [index, rawRecipe] of value.entries()) {
    const label = `ledger.tables.recipes.rows[${index}]`;
    const recipe = objectValue(rawRecipe, label);
    exactObjectKeys(recipe, ["recipe_id", "aliases"], label);
    const aliases = objectValue(recipe.aliases, `${label}.aliases`);
    exactObjectKeys(
      aliases,
      [...DATADECIDE_RECIPE_ALIAS_NAMESPACES],
      `${label}.aliases`,
    );
    const expected = EXPECTED_RECIPE_ALIASES[index]!;
    const expectedAliases: Record<DataDecideRecipeAliasNamespace, string> = {
      internal_slug: expected[0],
      public_slug: expected[1],
      evaluation_name: expected[2],
    };
    const recipeId = `recipe:${expectedAliases.internal_slug}`;
    if (recipe.recipe_id !== recipeId) {
      throw new TypeError(`recipe row ${index} must keep its exact internal identity`);
    }
    for (const namespace of DATADECIDE_RECIPE_ALIAS_NAMESPACES) {
      const alias = nonemptyString(aliases[namespace], `recipe ${recipeId} alias ${namespace}`);
      if (alias !== expectedAliases[namespace]) {
        throw new TypeError(`recipe ${recipeId} must keep its exact ${namespace} alias`);
      }
      const seen = aliasSets.get(namespace)!;
      if (seen.has(alias)) throw new TypeError(`duplicate recipe ${namespace} alias: ${alias}`);
      seen.add(alias);
    }
    const typed = recipe as unknown as DataDecideRecipe;
    if (byId.has(recipeId)) throw new TypeError(`duplicate DataDecide recipe id: ${recipeId}`);
    byId.set(recipeId, typed);
  }
  return byId;
}

function assertScales(
  value: unknown[],
  expectedCount: number,
  study: DataDecideLedger["study"],
): Map<string, DataDecideScale> {
  if (value.length !== expectedCount || value.length !== EXPECTED_SCALE_VALUES.length) {
    throw new TypeError("DataDecide scale table must contain all 14 scales");
  }
  const byId = new Map<string, DataDecideScale>();
  for (const [index, rawScale] of value.entries()) {
    const label = `ledger.tables.scales.rows[${index}]`;
    const scale = objectValue(rawScale, label);
    exactObjectKeys(
      scale,
      [
        "scale_id",
        "label",
        "non_embedding_parameters",
        "batch_sequences",
        "scheduled_full_steps",
        "scheduled_full_tokens",
        "hidden_size",
        "attention_heads",
        "layers",
        "learning_rate",
        "scientific_seed_ids",
        "operational_seed_ids",
      ],
      label,
    );
    const expected = EXPECTED_SCALE_VALUES[index]!;
    const [scaleLabel, params, batch, steps, tokens, hidden, heads, layers, learningRate] = expected;
    const exact = {
      scale_id: `scale:${scaleLabel}`,
      label: scaleLabel,
      non_embedding_parameters: params,
      batch_sequences: batch,
      scheduled_full_steps: steps,
      scheduled_full_tokens: tokens,
      hidden_size: hidden,
      attention_heads: heads,
      layers,
      learning_rate: learningRate,
    };
    for (const [key, expectedValue] of Object.entries(exact)) {
      if (scale[key] !== expectedValue) {
        throw new TypeError(`${label}.${key} does not match the pinned scale contract`);
      }
    }
    if (tokens !== steps * batch * study.sequence_length_evidence.resolution.ledger_value) {
      throw new TypeError(`${label} scheduled token arithmetic does not use the resolved sequence length`);
    }
    const scientificSeeds = scaleLabel === "1B"
      ? ["seed:6198", "seed:4", "seed:5"]
      : ["seed:6198", "seed:14", "seed:15"];
    const operationalSeeds = scaleLabel === "1B"
      ? ["seed:6198", "seed:14", "seed:15", "seed:4", "seed:5"]
      : scientificSeeds;
    exactStringArray(scale.scientific_seed_ids, scientificSeeds, `${label}.scientific_seed_ids`);
    exactStringArray(scale.operational_seed_ids, operationalSeeds, `${label}.operational_seed_ids`);
    const typed = scale as unknown as DataDecideScale;
    if (byId.has(typed.scale_id)) throw new TypeError(`duplicate DataDecide scale id: ${typed.scale_id}`);
    byId.set(typed.scale_id, typed);
  }
  return byId;
}

function assertSeeds(
  value: unknown[],
  scales: Map<string, DataDecideScale>,
): Map<string, DataDecideSeed> {
  if (value.length !== 5) throw new TypeError("DataDecide seed table must contain five seed identities");
  const expected = [
    [6198, "default", "default", SCALE_IDS, SCALE_IDS, "full-scale-schedule"],
    [14, "small aux 2", "small-aux-2", NON_TARGET_SCALE_IDS, SCALE_IDS, "min-full-scale-or-quarter-1B-target-compute"],
    [15, "small aux 3", "small-aux-3", NON_TARGET_SCALE_IDS, SCALE_IDS, "min-full-scale-or-quarter-1B-target-compute"],
    [4, "large aux 2", "large-aux-2", ["scale:1B"], ["scale:1B"], "full-scale-schedule"],
    [5, "large aux 3", "large-aux-3", ["scale:1B"], ["scale:1B"], "full-scale-schedule"],
  ] as const;
  const byId = new Map<string, DataDecideSeed>();
  const evaluationAliases = new Set<string>();
  const branchAliases = new Set<string>();
  for (const [index, rawSeed] of value.entries()) {
    const label = `ledger.tables.seeds.rows[${index}]`;
    const seed = objectValue(rawSeed, label);
    exactObjectKeys(
      seed,
      [
        "seed_id",
        "numeric_seed",
        "evaluation_alias",
        "branch_alias",
        "scientific_scale_ids",
        "operational_scale_ids",
        "stop_rule",
      ],
      label,
    );
    const [numeric, evaluationAlias, branchAlias, scientificScaleIds, operationalScaleIds, stopRule] = expected[index]!;
    const seedId = `seed:${numeric}`;
    if (
      seed.seed_id !== seedId
      || seed.numeric_seed !== numeric
      || seed.evaluation_alias !== evaluationAlias
      || seed.branch_alias !== branchAlias
      || seed.stop_rule !== stopRule
    ) {
      throw new TypeError(`${label} does not match its pinned numeric/alias seed identity`);
    }
    exactStringArray(seed.scientific_scale_ids, [...scientificScaleIds], `${label}.scientific_scale_ids`);
    exactStringArray(seed.operational_scale_ids, [...operationalScaleIds], `${label}.operational_scale_ids`);
    for (const scaleId of operationalScaleIds) {
      if (!scales.has(scaleId)) throw new TypeError(`${label} references an unknown operational scale`);
    }
    if (evaluationAliases.has(evaluationAlias) || branchAliases.has(branchAlias)) {
      throw new TypeError("DataDecide seed aliases must be unique in each namespace");
    }
    evaluationAliases.add(evaluationAlias);
    branchAliases.add(branchAlias);
    const typed = seed as unknown as DataDecideSeed;
    byId.set(seedId, typed);
  }

  for (const scale of scales.values()) {
    for (const seedId of scale.scientific_seed_ids) {
      if (!byId.get(seedId)?.scientific_scale_ids.includes(scale.scale_id)) {
        throw new TypeError("scale/seed scientific scope is not reciprocal");
      }
    }
    for (const seedId of scale.operational_seed_ids) {
      if (!byId.get(seedId)?.operational_scale_ids.includes(scale.scale_id)) {
        throw new TypeError("scale/seed operational scope is not reciprocal");
      }
    }
  }
  return byId;
}

function assertScientificAndOperationalCounts(
  recipes: Map<string, DataDecideRecipe>,
  scales: Map<string, DataDecideScale>,
  study: DataDecideLedger["study"],
): void {
  const scientificRuns = recipes.size * [...scales.values()]
    .reduce((total, scale) => total + scale.scientific_seed_ids.length, 0);
  const operationalRuns = recipes.size * [...scales.values()]
    .reduce((total, scale) => total + scale.operational_seed_ids.length, 0);
  if (scientificRuns !== study.scientific_model_run_count) {
    throw new TypeError("scientific recipe x scale x seed schedule does not reconcile to 1,050 runs");
  }
  if (operationalRuns !== study.operational_run_manifest_count) {
    throw new TypeError("operational recipe x scale x seed schedule does not reconcile to 1,100 runs");
  }
  if ([...scales.values()].some((scale) =>
    scale.scientific_seed_ids.length !== study.scientific_seeds_per_recipe_scale
  )) {
    throw new TypeError("each scientific recipe/scale path must have exactly three seeds");
  }
}

function assertCheckpoints(
  value: unknown[],
  recipes: Map<string, DataDecideRecipe>,
  scales: Map<string, DataDecideScale>,
  seeds: Map<string, DataDecideSeed>,
  sequenceLength: number,
): Map<string, DataDecideCheckpoint> {
  if (value.length !== EXPECTED_CHECKPOINT_TARGETS.size) {
    throw new TypeError("checkpoint table must contain the five bounded pinned witnesses");
  }
  const byId = new Map<string, DataDecideCheckpoint>();
  const pathKeys = new Set<string>();
  for (const [index, rawCheckpoint] of value.entries()) {
    const label = `ledger.tables.checkpoints.rows[${index}]`;
    const checkpoint = objectValue(rawCheckpoint, label);
    exactObjectKeys(
      checkpoint,
      [
        "checkpoint_id",
        "recipe_id",
        "scale_id",
        "seed_id",
        "step",
        "tokens",
        "compute_flops",
        "model_repo_id",
        "revision",
      ],
      label,
    );
    const recipe = recipes.get(nonemptyString(checkpoint.recipe_id, `${label}.recipe_id`));
    const scale = scales.get(nonemptyString(checkpoint.scale_id, `${label}.scale_id`));
    const seed = seeds.get(nonemptyString(checkpoint.seed_id, `${label}.seed_id`));
    if (!recipe || !scale || !seed) throw new TypeError(`${label} has a broken recipe/scale/seed foreign key`);
    if (
      !scale.operational_seed_ids.includes(seed.seed_id)
      || !seed.operational_scale_ids.includes(scale.scale_id)
    ) {
      throw new TypeError(`${label} uses a seed outside its operational scale scope`);
    }
    const step = positiveInteger(checkpoint.step, `${label}.step`);
    const expectedId = `checkpoint:${recipe.aliases.internal_slug}:${scale.label}:${seed.numeric_seed}:${step}`;
    if (checkpoint.checkpoint_id !== expectedId) {
      throw new TypeError(`${label}.checkpoint_id does not match its natural path key`);
    }
    const target = EXPECTED_CHECKPOINT_TARGETS.get(expectedId);
    if (!target) throw new TypeError(`${label} is not one of the bounded pinned checkpoint witnesses`);
    const expectedRepo = `allenai/DataDecide-${recipe.aliases.public_slug}-${scale.label}`;
    if (checkpoint.model_repo_id !== expectedRepo) {
      throw new TypeError(`${label}.model_repo_id must be derived from the explicit public recipe alias`);
    }
    const revision = objectValue(checkpoint.revision, `${label}.revision`);
    exactObjectKeys(
      revision,
      ["kind", "name", "target_commit_sha"],
      `${label}.revision`,
    );
    if (revision.kind !== "branch") {
      throw new TypeError(`${label} checkpoint revision must be an explicit Hub branch`);
    }
    const expectedBranch = `step${step}-seed-${seed.branch_alias}`;
    if (revision.name !== expectedBranch) {
      throw new TypeError(`${label} branch must match step plus the explicit seed branch alias`);
    }
    if (revision.target_commit_sha !== target) {
      throw new TypeError(`${label} branch target commit SHA does not match pinned evidence`);
    }
    sha40(revision.target_commit_sha, `${label}.revision.target_commit_sha`);
    const tokens = nonnegativeSafeInteger(checkpoint.tokens, `${label}.tokens`);
    if (tokens !== step * scale.batch_sequences * sequenceLength) {
      throw new TypeError(`${label}.tokens do not match step x batch x resolved sequence length`);
    }
    const compute = decimalInteger(checkpoint.compute_flops, `${label}.compute_flops`);
    const expectedCompute = 6n * BigInt(scale.non_embedding_parameters) * BigInt(tokens);
    if (BigInt(compute) !== expectedCompute) {
      throw new TypeError(`${label}.compute_flops does not match 6ND`);
    }
    const pathKey = [recipe.recipe_id, scale.scale_id, seed.seed_id, step].join("|");
    if (pathKeys.has(pathKey)) throw new TypeError(`duplicate DataDecide checkpoint path: ${pathKey}`);
    pathKeys.add(pathKey);
    const typed = checkpoint as unknown as DataDecideCheckpoint;
    if (byId.has(expectedId)) throw new TypeError(`duplicate DataDecide checkpoint id: ${expectedId}`);
    byId.set(expectedId, typed);
  }
  for (const expectedId of EXPECTED_CHECKPOINT_TARGETS.keys()) {
    if (!byId.has(expectedId)) throw new TypeError(`missing pinned checkpoint witness: ${expectedId}`);
  }
  return byId;
}

function assertCheckpointManifest(value: unknown, study: DataDecideLedger["study"]): void {
  const table = objectValue(value, "ledger.tables.checkpoints");
  const manifest = objectValue(table.source_manifest, "ledger.tables.checkpoints.source_manifest");
  exactObjectKeys(
    manifest,
    [
      "artifact_id",
      "path",
      "raw_run_rows",
      "excluded_legacy_rows",
      "usable_run_rows",
      "usable_checkpoint_revisions",
    ],
    "ledger.tables.checkpoints.source_manifest",
  );
  if (
    manifest.artifact_id !== "datadecide-source"
    || manifest.path !== "checkpoints/weka_paths.jsonl"
    || manifest.raw_run_rows !== 1103
    || manifest.excluded_legacy_rows !== 3
    || manifest.usable_run_rows !== study.operational_run_manifest_count
    || manifest.usable_checkpoint_revisions !== study.usable_checkpoint_revision_count
  ) {
    throw new TypeError("checkpoint source manifest counts/path must remain pinned");
  }
  if (manifest.raw_run_rows !== manifest.usable_run_rows + manifest.excluded_legacy_rows) {
    throw new TypeError("checkpoint source manifest exclusions do not reconcile");
  }
}

function assertEvaluations(
  value: unknown[],
  checkpoints: Map<string, DataDecideCheckpoint>,
  recipes: Map<string, DataDecideRecipe>,
  scales: Map<string, DataDecideScale>,
  seeds: Map<string, DataDecideSeed>,
  artifacts: Map<string, DataDecideArtifact>,
): void {
  if (value.length !== 2) throw new TypeError("evaluation table must contain two bounded aggregate witnesses");
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [index, rawEvaluation] of value.entries()) {
    const label = `ledger.tables.evaluations.rows[${index}]`;
    const evaluation = objectValue(rawEvaluation, label);
    exactObjectKeys(
      evaluation,
      [
        "evaluation_id",
        "checkpoint_id",
        "task_id",
        "protocol_id",
        "source_artifact_id",
        "source_revision",
        "source_coordinates",
        "metric",
      ],
      label,
    );
    const checkpoint = checkpoints.get(
      nonemptyString(evaluation.checkpoint_id, `${label}.checkpoint_id`),
    );
    if (!checkpoint) throw new TypeError(`${label} has a broken checkpoint foreign key`);
    const recipe = recipes.get(checkpoint.recipe_id)!;
    const scale = scales.get(checkpoint.scale_id)!;
    const seed = seeds.get(checkpoint.seed_id)!;
    const taskId = nonemptyString(evaluation.task_id, `${label}.task_id`);
    const protocolId = nonemptyString(evaluation.protocol_id, `${label}.protocol_id`);
    const expectedId = `evaluation:${recipe.aliases.internal_slug}:${scale.label}:${seed.numeric_seed}:${checkpoint.step}:${taskId}:${protocolId}`;
    if (evaluation.evaluation_id !== expectedId) {
      throw new TypeError(`${label}.evaluation_id does not match its natural path key`);
    }
    const expectedEvaluation = EXPECTED_EVALUATIONS.get(expectedId);
    if (!expectedEvaluation || expectedEvaluation.task !== taskId) {
      throw new TypeError(`${label} is not one of the bounded pinned evaluation witnesses`);
    }
    const sourceArtifactId = nonemptyString(
      evaluation.source_artifact_id,
      `${label}.source_artifact_id`,
    );
    if (sourceArtifactId !== expectedEvaluation.source_artifact_id) {
      throw new TypeError(`${label}.source_artifact_id must remain pinned to eval-results`);
    }
    if (evaluation.source_revision !== expectedEvaluation.source_revision) {
      throw new TypeError(`${label}.source_revision must equal the pinned eval-results SHA`);
    }
    const artifact = artifacts.get(sourceArtifactId);
    if (
      !artifact
      || artifact.revision !== expectedEvaluation.source_revision
      || !dataDecideArtifactOperationAllowed(artifact, "aggregate-read")
    ) {
      throw new TypeError(`${label} evaluation source is not permitted for aggregate reads`);
    }
    const coordinates = objectValue(evaluation.source_coordinates, `${label}.source_coordinates`);
    exactObjectKeys(
      coordinates,
      ["data", "params", "seed", "step", "chinchilla"],
      `${label}.source_coordinates`,
    );
    if (
      coordinates.data !== recipe.aliases.evaluation_name
      || coordinates.params !== scale.label
      || coordinates.seed !== seed.evaluation_alias
      || coordinates.step !== checkpoint.step
      || coordinates.chinchilla !== "5xC"
    ) {
      throw new TypeError(`${label}.source_coordinates do not exactly join to its checkpoint path`);
    }
    const metric = objectValue(evaluation.metric, `${label}.metric`);
    exactObjectKeys(
      metric,
      ["name", "selected_source_metric", "value"],
      `${label}.metric`,
    );
    if (
      metric.name !== "primary_metric"
      || metric.selected_source_metric !== expectedEvaluation.source_metric
      || metric.value !== expectedEvaluation.value
    ) {
      throw new TypeError(`${label}.metric does not match the pinned aggregate witness`);
    }
    finiteNumber(metric.value, `${label}.metric.value`);
    const path = [checkpoint.checkpoint_id, taskId, protocolId].join("|");
    if (paths.has(path)) throw new TypeError(`duplicate DataDecide evaluation path: ${path}`);
    paths.add(path);
    if (ids.has(expectedId)) throw new TypeError(`duplicate DataDecide evaluation id: ${expectedId}`);
    ids.add(expectedId);
  }
  for (const expectedId of EXPECTED_EVALUATIONS.keys()) {
    if (!ids.has(expectedId)) throw new TypeError(`missing pinned evaluation witness: ${expectedId}`);
  }
}

function assertEvaluationSourceSummary(
  value: unknown,
  artifacts: Map<string, DataDecideArtifact>,
): void {
  const table = objectValue(value, "ledger.tables.evaluations");
  const source = objectValue(table.source_summary, "ledger.tables.evaluations.source_summary");
  exactObjectKeys(
    source,
    [
      "artifact_id",
      "config",
      "split",
      "row_count",
      "metrics_encoding",
      "safe_parse_policy",
    ],
    "ledger.tables.evaluations.source_summary",
  );
  const artifact = artifacts.get("eval-results");
  if (
    source.artifact_id !== "eval-results"
    || source.config !== "default"
    || source.split !== "train"
    || source.row_count !== 1_410_750
    || source.metrics_encoding !== "python-literal-string"
    || source.safe_parse_policy !== EVALUATION_SAFE_PARSE_POLICY
    || !artifact
    || !dataDecideArtifactOperationAllowed(artifact, "aggregate-read")
  ) {
    throw new TypeError("evaluation source summary must preserve its pinned schema and safe parser boundary");
  }
}

function assertSequenceLengthDrift(
  study: DataDecideLedger["study"],
  scales: Map<string, DataDecideScale>,
  artifacts: Map<string, DataDecideArtifact>,
): void {
  const evidence = objectValue(
    study.sequence_length_evidence,
    "ledger.study.sequence_length_evidence",
  );
  const paper = objectValue(evidence.paper, "ledger.study.sequence_length_evidence.paper");
  const code = objectValue(evidence.code, "ledger.study.sequence_length_evidence.code");
  const arithmetic = objectValue(
    evidence.released_arithmetic,
    "ledger.study.sequence_length_evidence.released_arithmetic",
  );
  const resolution = objectValue(
    evidence.resolution,
    "ledger.study.sequence_length_evidence.resolution",
  );
  if (
    paper.version !== "2504.11393v2"
    || paper.table_value !== 2024
    || paper.source !== "https://arxiv.org/html/2504.11393v2"
  ) {
    throw new TypeError("paper sequence-length evidence must retain the published 2024 value");
  }
  if (
    code.revision !== artifacts.get("datadecide-source")?.revision
    || code.constant_value !== 2048
    || code.source
      !== "https://github.com/allenai/DataDecide/blob/68abc496587935b7211e9894206e78f15d535832/utils/constants.py#L254"
  ) {
    throw new TypeError("code sequence-length evidence must remain pinned at 2048");
  }
  if (
    resolution.status !== "documented-drift"
    || resolution.ledger_value !== code.constant_value
  ) {
    throw new TypeError("paper/code sequence-length conflict must remain explicit documented drift");
  }
  nonemptyString(resolution.reason, "ledger.study.sequence_length_evidence.resolution.reason");
  const scale = scales.get(nonemptyString(arithmetic.scale_id, "released_arithmetic.scale_id"));
  if (
    !scale
    || arithmetic.training_steps !== scale.scheduled_full_steps
    || arithmetic.batch_sequences !== scale.batch_sequences
    || arithmetic.released_tokens !== scale.scheduled_full_tokens
    || arithmetic.released_tokens
      !== arithmetic.training_steps * arithmetic.batch_sequences * resolution.ledger_value
  ) {
    throw new TypeError("released token arithmetic must independently support sequence length 2048");
  }
}

function tableRows(tables: Record<string, unknown>, tableName: string): unknown[] {
  const table = objectValue(tables[tableName], `ledger.tables.${tableName}`);
  if (!Array.isArray(table.rows)) throw new TypeError(`ledger.tables.${tableName}.rows must be an array`);
  return table.rows;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactObjectKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const allowed = new Set(expected);
  const ownKeys = Reflect.ownKeys(value);
  const unexpected = ownKeys.filter((key) =>
    typeof key !== "string" || !allowed.has(key)
  );
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  if (unexpected.length === 0 && missing.length === 0) return;

  const details: string[] = [];
  if (unexpected.length > 0) {
    details.push(`unexpected field(s): ${unexpected.map(String).join(", ")}`);
  }
  if (missing.length > 0) {
    details.push(`missing field(s): ${missing.join(", ")}`);
  }
  throw new TypeError(`${label} must be a closed object; ${details.join("; ")}`);
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 8_000) {
    throw new TypeError(`${label} must be a bounded non-empty string`);
  }
  return value;
}

function sha40(value: unknown, label: string): string {
  const text = nonemptyString(value, label);
  if (!SHA40.test(text)) throw new TypeError(`${label} must be a 40-character lowercase SHA`);
  return text;
}

function isoInstant(value: unknown, label: string): string {
  const text = nonemptyString(value, label);
  if (!ISO_INSTANT.test(text) || Number.isNaN(Date.parse(text))) {
    throw new TypeError(`${label} must be an ISO UTC instant`);
  }
  return text;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function nonnegativeSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  return value;
}

function decimalInteger(value: unknown, label: string): string {
  const text = nonemptyString(value, label);
  if (!DECIMAL_INTEGER.test(text)) throw new TypeError(`${label} must be an unsigned decimal integer string`);
  return text;
}

function exactStringArray(
  value: unknown,
  expected: readonly string[],
  label: string,
): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new TypeError(`${label} must be a string array`);
  }
  if (!sameStringArray(value, expected)) {
    throw new TypeError(`${label} must exactly equal: ${expected.join(", ")}`);
  }
  return value;
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
