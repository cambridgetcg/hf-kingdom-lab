import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const DPI_DATASET_ID = "common-pile/data_provenance_initiative_filtered";
export const DPI_HUB_OBJECT_ID = "683012bc2c98b5e9966e1ddf";
export const DPI_MAIN_REVISION = "8f5afcf585e4618ff12f5b6d49cb5242faf5afbd";
export const DPI_VIEWER_SOURCE_REVISION = "6e4d4d169effc075f0556a06b1c1c043f1cdf661";
export const DPI_CONVERT_REVISION = "a6219c6ca0e28d9c5eb2b325bd1305ff5cf13fc5";
export const DPI_VIEWER_ROWS = 3_508_390;
export const DPI_CARD_DOCUMENTS = 3_508_518;
export const DPI_COUNT_DISCREPANCY = 128;

export const DPI_SHARD_LENGTHS = [
  314_270,
  574_897,
  697_640,
  403_886,
  254_262,
  454_422,
  191_601,
  269_669,
  254_150,
  93_593,
] as const;

export const DPI_ALLOWED_METADATA_URLS = [
  `https://huggingface.co/api/datasets/${DPI_DATASET_ID}`,
  `https://huggingface.co/api/datasets/${DPI_DATASET_ID}/revision/refs%2Fconvert%2Fparquet`,
  `https://huggingface.co/api/datasets/${DPI_DATASET_ID}/tree/${DPI_VIEWER_SOURCE_REVISION}?recursive=true&expand=true`,
  `https://huggingface.co/api/datasets/${DPI_DATASET_ID}/tree/${DPI_CONVERT_REVISION}/default/train?recursive=true&expand=true`,
  `https://datasets-server.huggingface.co/splits?dataset=common-pile%2Fdata_provenance_initiative_filtered`,
  `https://datasets-server.huggingface.co/parquet?dataset=common-pile%2Fdata_provenance_initiative_filtered`,
  `https://datasets-server.huggingface.co/size?dataset=common-pile%2Fdata_provenance_initiative_filtered`,
  `https://datasets-server.huggingface.co/info?dataset=common-pile%2Fdata_provenance_initiative_filtered&config=default`,
] as const;

export const DPI_FORBIDDEN_DATASET_SERVER_PATHS = [
  "/first-rows",
  "/rows",
  "/filter",
  "/search",
] as const;

export const DPI_PROJECTED_LOGICAL_COLUMNS = [
  "id",
  "metadata.dataset_id",
  "metadata.language",
  "metadata.license",
  "metadata.license_url",
  "metadata.provenance",
  "metadata.url",
] as const;

export const DPI_EXCLUDED_CONTENT_COLUMNS = [
  "text",
  "metadata.response",
] as const;

export const DPI_UNPROJECTED_LOGICAL_COLUMNS = [
  "added",
  "source",
] as const;

const MANIFEST_DIGEST_SERIALIZATION =
  "path, decimal size, and lowercase LFS SHA-256 separated by TAB; paths sorted lexicographically; every record terminated by LF";
const SCHEMA_DIGEST_SERIALIZATION = "sorted-key compact UTF-8 JSON followed by LF";
const ORIGINAL_MANIFEST_DIGEST =
  "955ed01b942dfc1e7648b23fb56bfa74956cadf2e0569ce68b60fa68d2916c94";
const PARQUET_MANIFEST_DIGEST =
  "48489544cad439e5f706a18ddebd7f2ed84f70f684b952457df289e490bf5b21";
const SCHEMA_DIGEST =
  "ac1a8ea25ff81141f51b9682df6567a7be8084d924ceb15c37f4dd56f9681913";
const SHA256 = /^[a-f0-9]{64}$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

const ORIGINAL_FILES = [
  {
    path: "dpi-common-pile-0000.json.gz",
    size: 633_553_694,
    lfs_sha256: "52634e4bc6a36173c7c45e41d03add9dd4c2f90523044568dea7cbb2224c20c0",
  },
  {
    path: "dpi-common-pile-0001.json.gz",
    size: 284_305_547,
    lfs_sha256: "1fbc108998b1c4fda253c2ea75e866dcdeb8388591ff7f99c0e8caa6ffcf14d5",
  },
  {
    path: "dpi-common-pile-0002.json.gz",
    size: 307_758_936,
    lfs_sha256: "3ff90707d712601aca1c8f1028e3491bdf71a9ef0d15b47a079dbad6718d445f",
  },
] as const;

const PARQUET_FILES = [
  {
    path: "default/train/0000.parquet",
    size: 191_142_381,
    lfs_sha256: "6df626ce8cc2a61521e06d1a480adbc98cfafa1add9731e9f7f208d59c82eefd",
  },
  {
    path: "default/train/0001.parquet",
    size: 179_378_517,
    lfs_sha256: "ce4bd1f0136724e4691d76363e8c120483fa222d79f1fd2d7b29e48afa99ed4a",
  },
  {
    path: "default/train/0002.parquet",
    size: 122_161_026,
    lfs_sha256: "c7d670f7f832aefd769dc019057549d5a2ac1f04f4af8c348306179c76881e62",
  },
  {
    path: "default/train/0003.parquet",
    size: 171_610_509,
    lfs_sha256: "c3790e5c5bb5eefbc6ac8fafa642fa79198a45f836023ec987da99b711efffbf",
  },
  {
    path: "default/train/0004.parquet",
    size: 222_544_416,
    lfs_sha256: "0f113cb3b0729a0ace558a1b45c490c34b781f489465087e39238e14a0066f82",
  },
  {
    path: "default/train/0005.parquet",
    size: 182_548_035,
    lfs_sha256: "23c3073fadd4de63a6310a9bacb40d46237c559608bf330c0246d3b1bcf5b10e",
  },
  {
    path: "default/train/0006.parquet",
    size: 250_037_969,
    lfs_sha256: "cb8f4e297e1f399600b4a11f5285834f3dc8168d77280be6cdeff1eb92d43ac2",
  },
  {
    path: "default/train/0007.parquet",
    size: 243_615_465,
    lfs_sha256: "21c0e670ae341397d127a576992f2de164748aed4d16ab626083388bb9b4c023",
  },
  {
    path: "default/train/0008.parquet",
    size: 247_262_461,
    lfs_sha256: "fdfac20e37fdc5283b092bc749672e2975d9a6634a94841d6c14e9e0bf83b7d4",
  },
  {
    path: "default/train/0009.parquet",
    size: 81_432_459,
    lfs_sha256: "ddf2ae8537f95b7d204810a32ad38375d1c346e69b523eaeb4626c7f3da57a0d",
  },
] as const;

const STRING_VALUE = { dtype: "string", _type: "Value" } as const;
const STRING_SEQUENCE = {
  feature: STRING_VALUE,
  _type: "Sequence",
} as const;
const EXPECTED_FEATURES = {
  added: STRING_VALUE,
  id: STRING_VALUE,
  metadata: {
    dataset_id: STRING_VALUE,
    language: STRING_SEQUENCE,
    license: STRING_SEQUENCE,
    license_url: STRING_VALUE,
    provenance: STRING_VALUE,
    response: STRING_VALUE,
    url: STRING_VALUE,
  },
  source: STRING_VALUE,
  text: STRING_VALUE,
} as const;

const DESIGN_MEASUREMENT = {
  method:
    "Bounded HTTPS range reads over all ten immutable Parquet files; footer metadata only, with no column data pages requested",
  tool: "pyarrow 23.0.0",
  shards_inspected: 10,
  rows: DPI_VIEWER_ROWS,
  row_groups: 3_768,
  serialized_footer_bytes: 9_798_821,
  range_bytes_received: 10_454_181,
  projected_compressed_column_bytes: 56_455_411,
  excluded_compressed_column_bytes: 1_791_329_876,
  other_compressed_column_bytes: 24_465_143,
  text_min_max_statistics_observed: true,
  raw_statistic_values_retained: false,
  column_data_pages_read: false,
} as const;

const READER_REQUIRED_PREREQUISITES = {
  immutable_commit_urls_only: true,
  core_httpfs_prepared_and_hash_pinned: true,
  automatic_extension_install_and_load_disabled: true,
  community_extensions_disabled: true,
  credentials_and_proxy_environment_scrubbed: true,
  fixed_sql_and_column_projection_only: true,
  hard_wall_deadline_with_process_group_kill: true,
  memory_thread_temp_and_output_caps: true,
  redirect_targets_allowlisted_and_not_logged: true,
  hard_network_byte_cap_enforced: true,
  closed_aggregate_output_schema: true,
} as const;

const OFFICIAL_DOCS = [
  "https://huggingface.co/docs/dataset-viewer/quick_start",
  "https://huggingface.co/docs/dataset-viewer/parquet",
  "https://huggingface.co/docs/hub/main/datasets-viewer-sql-console",
  "https://huggingface.co/docs/hub/xet/overview",
  "https://duckdb.org/docs/current/core_extensions/httpfs/https.html",
  "https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview.html",
] as const;

const DEFAULT_CONTRACT_PATH = resolve(
  import.meta.dir,
  "..",
  "data",
  "dpi-provenance-contract.v1.json",
);

export interface DpiManifestFile {
  path: string;
  size: number;
  lfs_sha256: string;
}

export interface DpiProvenanceContract {
  protocol: "hf-kingdom-dpi-provenance-contract/v1";
  observed_at: string;
  purpose: string;
  identity: {
    dataset_id: typeof DPI_DATASET_ID;
    hub_object_id: typeof DPI_HUB_OBJECT_ID;
    canonical_url: `https://huggingface.co/datasets/${typeof DPI_DATASET_ID}`;
    main_revision: typeof DPI_MAIN_REVISION;
    viewer_source_revision: typeof DPI_VIEWER_SOURCE_REVISION;
    convert_revision: typeof DPI_CONVERT_REVISION;
    config: "default";
    split: "train";
    public: true;
    gated: false;
    disabled: false;
  };
  original_exports: DpiExportManifest;
  parquet_exports: DpiExportManifest;
  viewer: {
    rows: typeof DPI_VIEWER_ROWS;
    columns: 5;
    memory_bytes: 4_712_748_443;
    partial: false;
    pending: [];
    failed: [];
    shard_lengths: number[];
    schema: {
      digest: string;
      digest_serialization: typeof SCHEMA_DIGEST_SERIALIZATION;
      features: typeof EXPECTED_FEATURES;
    };
  };
  count_reconciliation: {
    dataset_card_documents: typeof DPI_CARD_DOCUMENTS;
    viewer_rows: typeof DPI_VIEWER_ROWS;
    card_minus_viewer: typeof DPI_COUNT_DISCREPANCY;
    resolved: false;
    interpretation: string;
  };
  access: {
    mode: "static-local-contract-only";
    allowed_metadata_urls: string[];
    forbidden_dataset_server_paths: string[];
    default_deny: true;
    bodyless_get_only: true;
    credentials_omitted: true;
    redirects_followed: false;
    max_metadata_requests: 8;
    max_response_body_bytes_per_request: 65_536;
    max_total_response_body_bytes: 262_144;
    max_wall_time_ms: 15_000;
    partial_results_permitted: false;
    malformed_or_drifted_metadata_fails_closed: true;
    dataset_rows_read: false;
    remote_writes: [];
  };
  column_boundary: {
    projected_logical_columns: string[];
    excluded_content_columns: string[];
    unprojected_logical_columns: string[];
    select_star_permitted: false;
    row_level_output_permitted: false;
  };
  design_measurement: typeof DESIGN_MEASUREMENT;
  reader: {
    reader_implemented: false;
    reader_runtime_available: false;
    reader_execution_in_scope: false;
    reason: string;
    guarantee_ceiling: string;
    required_prerequisites: typeof READER_REQUIRED_PREREQUISITES;
  };
  evidence_boundary: {
    classification: "publisher_provenance_assertion";
    contract_loader_network_access: false;
    contract_contains_raw_dataset_text: false;
    remote_dataset_rows_collected: false;
    remote_column_data_pages_collected: false;
    parquet_footer_metadata_inspected_during_design: true;
    lfs_sha256_locally_verified: false;
    manifest_digests_cover_metadata_assertions_not_file_bytes: true;
    license_metadata_is_legal_advice_or_authorization: false;
    dataset_card_warns_of_license_laundering_or_inaccuracy: true;
  };
  official_docs: string[];
}

interface DpiExportManifest {
  revision: string;
  total_bytes: number;
  manifest_digest: string;
  manifest_digest_serialization: typeof MANIFEST_DIGEST_SERIALIZATION;
  files: DpiManifestFile[];
}

export async function loadDpiProvenanceContract(
  path = DEFAULT_CONTRACT_PATH,
): Promise<DpiProvenanceContract> {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  assertDpiProvenanceContract(value);
  return value;
}

/**
 * Validate the checked-in static contract. This function performs no network
 * request and does not prepare or invoke a dataset reader.
 */
export function assertDpiProvenanceContract(
  value: unknown,
): asserts value is DpiProvenanceContract {
  const contract = exactObject(value, [
    "access",
    "column_boundary",
    "count_reconciliation",
    "design_measurement",
    "evidence_boundary",
    "identity",
    "observed_at",
    "official_docs",
    "original_exports",
    "parquet_exports",
    "protocol",
    "purpose",
    "reader",
    "viewer",
  ], "DPI contract");
  exact(contract.protocol, "hf-kingdom-dpi-provenance-contract/v1", "contract.protocol");
  if (typeof contract.observed_at !== "string" || !ISO_INSTANT.test(contract.observed_at)) {
    fail("contract.observed_at must be an ISO UTC instant");
  }
  boundedString(contract.purpose, "contract.purpose", 1, 1_000);

  const identity = exactObject(contract.identity, [
    "canonical_url",
    "config",
    "convert_revision",
    "dataset_id",
    "disabled",
    "gated",
    "hub_object_id",
    "main_revision",
    "public",
    "split",
    "viewer_source_revision",
  ], "contract.identity");
  exact(identity.dataset_id, DPI_DATASET_ID, "identity.dataset_id");
  exact(identity.hub_object_id, DPI_HUB_OBJECT_ID, "identity.hub_object_id");
  exact(
    identity.canonical_url,
    `https://huggingface.co/datasets/${DPI_DATASET_ID}`,
    "identity.canonical_url",
  );
  exact(identity.main_revision, DPI_MAIN_REVISION, "identity.main_revision");
  exact(
    identity.viewer_source_revision,
    DPI_VIEWER_SOURCE_REVISION,
    "identity.viewer_source_revision",
  );
  exact(identity.convert_revision, DPI_CONVERT_REVISION, "identity.convert_revision");
  exact(identity.config, "default", "identity.config");
  exact(identity.split, "train", "identity.split");
  exact(identity.public, true, "identity.public");
  exact(identity.gated, false, "identity.gated");
  exact(identity.disabled, false, "identity.disabled");

  validateManifest(
    contract.original_exports,
    "contract.original_exports",
    DPI_VIEWER_SOURCE_REVISION,
    1_225_618_177,
    ORIGINAL_MANIFEST_DIGEST,
    ORIGINAL_FILES,
  );
  validateManifest(
    contract.parquet_exports,
    "contract.parquet_exports",
    DPI_CONVERT_REVISION,
    1_891_733_238,
    PARQUET_MANIFEST_DIGEST,
    PARQUET_FILES,
  );

  const viewer = exactObject(contract.viewer, [
    "columns",
    "failed",
    "memory_bytes",
    "partial",
    "pending",
    "rows",
    "schema",
    "shard_lengths",
  ], "contract.viewer");
  exact(viewer.rows, DPI_VIEWER_ROWS, "viewer.rows");
  exact(viewer.columns, 5, "viewer.columns");
  exact(viewer.memory_bytes, 4_712_748_443, "viewer.memory_bytes");
  exact(viewer.partial, false, "viewer.partial");
  exactArray(viewer.pending, [], "viewer.pending");
  exactArray(viewer.failed, [], "viewer.failed");
  exactArray(viewer.shard_lengths, DPI_SHARD_LENGTHS, "viewer.shard_lengths");
  const shardTotal = DPI_SHARD_LENGTHS.reduce((total, rows) => total + rows, 0);
  if (shardTotal !== DPI_VIEWER_ROWS) fail("pinned shard lengths do not sum to Viewer rows");

  const schema = exactObject(viewer.schema, [
    "digest",
    "digest_serialization",
    "features",
  ], "viewer.schema");
  exact(schema.digest, SCHEMA_DIGEST, "viewer.schema.digest");
  exact(
    schema.digest_serialization,
    SCHEMA_DIGEST_SERIALIZATION,
    "viewer.schema.digest_serialization",
  );
  exactJson(schema.features, EXPECTED_FEATURES, "viewer.schema.features");
  exact(
    sha256(`${canonicalJson(schema.features)}\n`),
    SCHEMA_DIGEST,
    "viewer.schema computed digest",
  );

  const reconciliation = exactObject(contract.count_reconciliation, [
    "card_minus_viewer",
    "dataset_card_documents",
    "interpretation",
    "resolved",
    "viewer_rows",
  ], "contract.count_reconciliation");
  exact(
    reconciliation.dataset_card_documents,
    DPI_CARD_DOCUMENTS,
    "count_reconciliation.dataset_card_documents",
  );
  exact(reconciliation.viewer_rows, DPI_VIEWER_ROWS, "count_reconciliation.viewer_rows");
  exact(
    reconciliation.card_minus_viewer,
    DPI_COUNT_DISCREPANCY,
    "count_reconciliation.card_minus_viewer",
  );
  exact(reconciliation.resolved, false, "count_reconciliation.resolved");
  boundedString(reconciliation.interpretation, "count_reconciliation.interpretation", 1, 1_000);
  if (
    Number(reconciliation.dataset_card_documents) - Number(reconciliation.viewer_rows)
    !== reconciliation.card_minus_viewer
  ) {
    fail("count reconciliation arithmetic is inconsistent");
  }

  const access = exactObject(contract.access, [
    "allowed_metadata_urls",
    "bodyless_get_only",
    "credentials_omitted",
    "dataset_rows_read",
    "default_deny",
    "forbidden_dataset_server_paths",
    "malformed_or_drifted_metadata_fails_closed",
    "max_metadata_requests",
    "max_response_body_bytes_per_request",
    "max_total_response_body_bytes",
    "max_wall_time_ms",
    "mode",
    "partial_results_permitted",
    "redirects_followed",
    "remote_writes",
  ], "contract.access");
  exact(access.mode, "static-local-contract-only", "access.mode");
  exactArray(
    access.allowed_metadata_urls,
    DPI_ALLOWED_METADATA_URLS,
    "access.allowed_metadata_urls",
  );
  exactArray(
    access.forbidden_dataset_server_paths,
    DPI_FORBIDDEN_DATASET_SERVER_PATHS,
    "access.forbidden_dataset_server_paths",
  );
  for (const rawUrl of DPI_ALLOWED_METADATA_URLS) {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:"
      || (url.hostname !== "huggingface.co"
        && url.hostname !== "datasets-server.huggingface.co")
      || DPI_FORBIDDEN_DATASET_SERVER_PATHS.includes(
        url.pathname as (typeof DPI_FORBIDDEN_DATASET_SERVER_PATHS)[number],
      )
    ) {
      fail("allowed metadata URL crossed the fixed public metadata boundary");
    }
  }
  exact(access.default_deny, true, "access.default_deny");
  exact(access.bodyless_get_only, true, "access.bodyless_get_only");
  exact(access.credentials_omitted, true, "access.credentials_omitted");
  exact(access.redirects_followed, false, "access.redirects_followed");
  exact(access.max_metadata_requests, 8, "access.max_metadata_requests");
  exact(
    access.max_response_body_bytes_per_request,
    65_536,
    "access.max_response_body_bytes_per_request",
  );
  exact(
    access.max_total_response_body_bytes,
    262_144,
    "access.max_total_response_body_bytes",
  );
  exact(access.max_wall_time_ms, 15_000, "access.max_wall_time_ms");
  exact(access.partial_results_permitted, false, "access.partial_results_permitted");
  exact(
    access.malformed_or_drifted_metadata_fails_closed,
    true,
    "access.malformed_or_drifted_metadata_fails_closed",
  );
  exact(access.dataset_rows_read, false, "access.dataset_rows_read");
  exactArray(access.remote_writes, [], "access.remote_writes");

  const columns = exactObject(contract.column_boundary, [
    "excluded_content_columns",
    "projected_logical_columns",
    "row_level_output_permitted",
    "select_star_permitted",
    "unprojected_logical_columns",
  ], "contract.column_boundary");
  exactArray(
    columns.projected_logical_columns,
    DPI_PROJECTED_LOGICAL_COLUMNS,
    "column_boundary.projected_logical_columns",
  );
  exactArray(
    columns.excluded_content_columns,
    DPI_EXCLUDED_CONTENT_COLUMNS,
    "column_boundary.excluded_content_columns",
  );
  exactArray(
    columns.unprojected_logical_columns,
    DPI_UNPROJECTED_LOGICAL_COLUMNS,
    "column_boundary.unprojected_logical_columns",
  );
  exact(columns.select_star_permitted, false, "column_boundary.select_star_permitted");
  exact(
    columns.row_level_output_permitted,
    false,
    "column_boundary.row_level_output_permitted",
  );
  const projected = new Set<string>(DPI_PROJECTED_LOGICAL_COLUMNS);
  if (DPI_EXCLUDED_CONTENT_COLUMNS.some((column) => projected.has(column))) {
    fail("projected and excluded DPI columns must be disjoint");
  }

  const measurement = exactObject(
    contract.design_measurement,
    Object.keys(DESIGN_MEASUREMENT),
    "contract.design_measurement",
  );
  exactJson(measurement, DESIGN_MEASUREMENT, "contract.design_measurement");

  const reader = exactObject(contract.reader, [
    "guarantee_ceiling",
    "reader_execution_in_scope",
    "reader_implemented",
    "reader_runtime_available",
    "reason",
    "required_prerequisites",
  ], "contract.reader");
  exact(reader.reader_implemented, false, "reader.reader_implemented");
  exact(reader.reader_runtime_available, false, "reader.reader_runtime_available");
  exact(reader.reader_execution_in_scope, false, "reader.reader_execution_in_scope");
  boundedString(reader.reason, "reader.reason", 1, 1_000);
  boundedString(reader.guarantee_ceiling, "reader.guarantee_ceiling", 1, 1_000);
  const requiredPrerequisites = exactObject(
    reader.required_prerequisites,
    Object.keys(READER_REQUIRED_PREREQUISITES),
    "reader.required_prerequisites",
  );
  exactJson(
    requiredPrerequisites,
    READER_REQUIRED_PREREQUISITES,
    "reader.required_prerequisites",
  );

  const evidence = exactObject(contract.evidence_boundary, [
    "classification",
    "contract_contains_raw_dataset_text",
    "contract_loader_network_access",
    "dataset_card_warns_of_license_laundering_or_inaccuracy",
    "lfs_sha256_locally_verified",
    "license_metadata_is_legal_advice_or_authorization",
    "manifest_digests_cover_metadata_assertions_not_file_bytes",
    "parquet_footer_metadata_inspected_during_design",
    "remote_column_data_pages_collected",
    "remote_dataset_rows_collected",
  ], "contract.evidence_boundary");
  exact(evidence.classification, "publisher_provenance_assertion", "evidence.classification");
  exact(evidence.contract_loader_network_access, false, "evidence.contract_loader_network_access");
  exact(evidence.contract_contains_raw_dataset_text, false, "evidence.contract_contains_raw_dataset_text");
  exact(evidence.remote_dataset_rows_collected, false, "evidence.remote_dataset_rows_collected");
  exact(
    evidence.remote_column_data_pages_collected,
    false,
    "evidence.remote_column_data_pages_collected",
  );
  exact(
    evidence.parquet_footer_metadata_inspected_during_design,
    true,
    "evidence.parquet_footer_metadata_inspected_during_design",
  );
  exact(evidence.lfs_sha256_locally_verified, false, "evidence.lfs_sha256_locally_verified");
  exact(
    evidence.manifest_digests_cover_metadata_assertions_not_file_bytes,
    true,
    "evidence.manifest_digests_cover_metadata_assertions_not_file_bytes",
  );
  exact(
    evidence.license_metadata_is_legal_advice_or_authorization,
    false,
    "evidence.license_metadata_is_legal_advice_or_authorization",
  );
  exact(
    evidence.dataset_card_warns_of_license_laundering_or_inaccuracy,
    true,
    "evidence.dataset_card_warns_of_license_laundering_or_inaccuracy",
  );

  exactArray(contract.official_docs, OFFICIAL_DOCS, "contract.official_docs");
}

function validateManifest(
  value: unknown,
  label: string,
  revision: string,
  totalBytes: number,
  digest: string,
  expectedFiles: readonly DpiManifestFile[],
): void {
  const manifest = exactObject(value, [
    "files",
    "manifest_digest",
    "manifest_digest_serialization",
    "revision",
    "total_bytes",
  ], label);
  exact(manifest.revision, revision, `${label}.revision`);
  exact(manifest.total_bytes, totalBytes, `${label}.total_bytes`);
  exact(manifest.manifest_digest, digest, `${label}.manifest_digest`);
  exact(
    manifest.manifest_digest_serialization,
    MANIFEST_DIGEST_SERIALIZATION,
    `${label}.manifest_digest_serialization`,
  );
  if (!Array.isArray(manifest.files) || manifest.files.length !== expectedFiles.length) {
    fail(`${label}.files must contain the exact pinned manifest`);
  }
  const files: DpiManifestFile[] = [];
  for (const [index, expected] of expectedFiles.entries()) {
    const file = exactObject(
      manifest.files[index],
      ["lfs_sha256", "path", "size"],
      `${label}.files[${index}]`,
    );
    exact(file.path, expected.path, `${label}.files[${index}].path`);
    exact(file.size, expected.size, `${label}.files[${index}].size`);
    exact(file.lfs_sha256, expected.lfs_sha256, `${label}.files[${index}].lfs_sha256`);
    if (typeof file.lfs_sha256 !== "string" || !SHA256.test(file.lfs_sha256)) {
      fail(`${label}.files[${index}].lfs_sha256 must be lowercase SHA-256`);
    }
    files.push({
      path: file.path as string,
      size: file.size as number,
      lfs_sha256: file.lfs_sha256,
    });
  }
  const summedBytes = files.reduce((total, file) => total + file.size, 0);
  exact(summedBytes, totalBytes, `${label} computed total bytes`);
  exact(manifestDigest(files), digest, `${label} computed manifest digest`);
}

function manifestDigest(files: readonly DpiManifestFile[]): string {
  const body = [...files]
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
    .map((file) => `${file.path}\t${file.size}\t${file.lfs_sha256}\n`)
    .join("");
  return sha256(body);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} must use the closed contract schema`);
  }
  return object;
}

function exactArray(
  value: unknown,
  expected: readonly unknown[],
  label: string,
): void {
  if (!Array.isArray(value) || canonicalJson(value) !== canonicalJson(expected)) {
    fail(`${label} must match the exact pinned contract`);
  }
}

function exactJson(value: unknown, expected: unknown, label: string): void {
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(`${label} must match the exact pinned contract`);
  }
}

function exact(value: unknown, expected: unknown, label: string): void {
  if (!Object.is(value, expected)) fail(`${label} must equal ${String(expected)}`);
}

function boundedString(value: unknown, label: string, minimum: number, maximum: number): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    fail(`${label} must be a bounded non-empty string`);
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("canonical JSON contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(object[key])}`
    ).join(",")}}`;
  }
  fail("value is not canonical JSON");
}

function fail(message: string): never {
  throw new TypeError(`invalid DPI provenance contract: ${message}`);
}
