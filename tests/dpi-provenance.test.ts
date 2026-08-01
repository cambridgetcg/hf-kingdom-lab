import { describe, expect, test } from "bun:test";
import {
  assertDpiProvenanceContract,
  DPI_ALLOWED_METADATA_URLS,
  DPI_CARD_DOCUMENTS,
  DPI_CONVERT_REVISION,
  DPI_COUNT_DISCREPANCY,
  DPI_DATASET_ID,
  DPI_EXCLUDED_CONTENT_COLUMNS,
  DPI_FORBIDDEN_DATASET_SERVER_PATHS,
  DPI_MAIN_REVISION,
  DPI_PROJECTED_LOGICAL_COLUMNS,
  DPI_SHARD_LENGTHS,
  DPI_VIEWER_ROWS,
  DPI_VIEWER_SOURCE_REVISION,
  loadDpiProvenanceContract,
  type DpiProvenanceContract,
} from "../src/dpi-provenance.ts";

describe("static DPI provenance contract", () => {
  test("loads the exact public source and conversion identities without a reader", async () => {
    const contract = await loadDpiProvenanceContract();

    expect(contract.identity).toEqual(expect.objectContaining({
      dataset_id: DPI_DATASET_ID,
      main_revision: DPI_MAIN_REVISION,
      viewer_source_revision: DPI_VIEWER_SOURCE_REVISION,
      convert_revision: DPI_CONVERT_REVISION,
      public: true,
      gated: false,
      disabled: false,
    }));
    expect(contract.original_exports.files).toHaveLength(3);
    expect(contract.parquet_exports.files).toHaveLength(10);
    expect(contract.original_exports.files.reduce((sum, file) => sum + file.size, 0))
      .toBe(contract.original_exports.total_bytes);
    expect(contract.parquet_exports.files.reduce((sum, file) => sum + file.size, 0))
      .toBe(contract.parquet_exports.total_bytes);
    expect(new Set(contract.parquet_exports.files.map((file) => file.path)).size).toBe(10);
    expect(contract.parquet_exports.files.every((file) =>
      /^[a-f0-9]{64}$/u.test(file.lfs_sha256)
    )).toBe(true);
    expect(contract.reader).toEqual(expect.objectContaining({
      reader_implemented: false,
      reader_runtime_available: false,
      reader_execution_in_scope: false,
    }));
    expect(contract.evidence_boundary.contract_loader_network_access).toBe(false);
  });

  test("pins Viewer schema, shard lengths, and the unresolved 128-row discrepancy", async () => {
    const contract = await loadDpiProvenanceContract();

    expect(contract.viewer.rows).toBe(DPI_VIEWER_ROWS);
    expect(contract.viewer.shard_lengths).toEqual([...DPI_SHARD_LENGTHS]);
    expect(contract.viewer.shard_lengths.reduce((sum, rows) => sum + rows, 0))
      .toBe(DPI_VIEWER_ROWS);
    expect(Object.keys(contract.viewer.schema.features)).toEqual([
      "added",
      "id",
      "metadata",
      "source",
      "text",
    ]);
    expect(Object.keys(contract.viewer.schema.features.metadata)).toEqual([
      "dataset_id",
      "language",
      "license",
      "license_url",
      "provenance",
      "response",
      "url",
    ]);
    expect(contract.count_reconciliation).toEqual(expect.objectContaining({
      dataset_card_documents: DPI_CARD_DOCUMENTS,
      viewer_rows: DPI_VIEWER_ROWS,
      card_minus_viewer: DPI_COUNT_DISCREPANCY,
      resolved: false,
    }));
    expect(
      contract.count_reconciliation.dataset_card_documents
        - contract.count_reconciliation.viewer_rows,
    ).toBe(128);
  });

  test("default-denies row endpoints and exposes only the fixed metadata allowlist", async () => {
    const contract = await loadDpiProvenanceContract();

    expect(contract.access.mode).toBe("static-local-contract-only");
    expect(contract.access.allowed_metadata_urls).toEqual([...DPI_ALLOWED_METADATA_URLS]);
    expect(contract.access.forbidden_dataset_server_paths)
      .toEqual([...DPI_FORBIDDEN_DATASET_SERVER_PATHS]);
    expect(contract.access).toEqual(expect.objectContaining({
      default_deny: true,
      bodyless_get_only: true,
      credentials_omitted: true,
      redirects_followed: false,
      max_metadata_requests: 8,
      max_response_body_bytes_per_request: 65_536,
      max_total_response_body_bytes: 262_144,
      max_wall_time_ms: 15_000,
      partial_results_permitted: false,
      malformed_or_drifted_metadata_fails_closed: true,
      dataset_rows_read: false,
      remote_writes: [],
    }));
    for (const rawUrl of contract.access.allowed_metadata_urls) {
      const url = new URL(rawUrl);
      expect(url.pathname).not.toContain("/resolve/");
      expect(DPI_FORBIDDEN_DATASET_SERVER_PATHS).not.toContain(url.pathname);
    }
  });

  test("keeps the future projection disjoint from text and response", async () => {
    const contract = await loadDpiProvenanceContract();

    expect(contract.column_boundary.projected_logical_columns)
      .toEqual([...DPI_PROJECTED_LOGICAL_COLUMNS]);
    expect(contract.column_boundary.excluded_content_columns)
      .toEqual([...DPI_EXCLUDED_CONTENT_COLUMNS]);
    expect(contract.column_boundary.select_star_permitted).toBe(false);
    expect(contract.column_boundary.row_level_output_permitted).toBe(false);
    expect(contract.column_boundary.projected_logical_columns).not.toContain("text");
    expect(contract.column_boundary.projected_logical_columns)
      .not.toContain("metadata.response");
    expect(contract.design_measurement).toEqual(expect.objectContaining({
      shards_inspected: 10,
      rows: DPI_VIEWER_ROWS,
      text_min_max_statistics_observed: true,
      raw_statistic_values_retained: false,
      column_data_pages_read: false,
    }));
    expect(
      Object.values(contract.reader.required_prerequisites)
        .every((isRequired) => isRequired === true),
    )
      .toBe(true);
  });

  test("fails closed on identity, manifest, schema, endpoint, column, or runtime drift", async () => {
    const contract = await loadDpiProvenanceContract();
    const mutations: Array<(value: DpiProvenanceContract) => void> = [
      (value) => {
        (value as unknown as { identity: { main_revision: string } })
          .identity.main_revision = "0".repeat(40);
      },
      (value) => {
        (value as unknown as {
          parquet_exports: { files: Array<{ path: string }> };
        }).parquet_exports.files[0]!.path = "default/train/evil.parquet";
      },
      (value) => {
        (value as unknown as {
          parquet_exports: { files: Array<{ size: number }> };
        }).parquet_exports.files[0]!.size += 1;
      },
      (value) => {
        (value as unknown as {
          parquet_exports: { files: Array<{ lfs_sha256: string }> };
        }).parquet_exports.files[0]!.lfs_sha256 = "0".repeat(64);
      },
      (value) => {
        value.viewer.shard_lengths[0]! += 1;
      },
      (value) => {
        (value.viewer.schema.features as unknown as {
          metadata: { response: { dtype: string } };
        }).metadata.response.dtype = "large_string";
      },
      (value) => {
        (value as unknown as {
          count_reconciliation: { card_minus_viewer: number };
        }).count_reconciliation.card_minus_viewer = 0;
      },
      (value) => {
        value.access.allowed_metadata_urls.push(
          `https://datasets-server.huggingface.co/rows?dataset=${DPI_DATASET_ID}`,
        );
      },
      (value) => {
        value.access.forbidden_dataset_server_paths.splice(1, 1);
      },
      (value) => {
        (value as unknown as { access: { max_metadata_requests: number } })
          .access.max_metadata_requests = 9;
      },
      (value) => {
        value.column_boundary.projected_logical_columns.push("text");
      },
      (value) => {
        (value as unknown as { reader: { reader_runtime_available: boolean } })
          .reader.reader_runtime_available = true;
      },
      (value) => {
        (value.reader.required_prerequisites as unknown as {
          hard_network_byte_cap_enforced: boolean;
        })
          .hard_network_byte_cap_enforced = false;
      },
    ];

    for (const mutate of mutations) {
      const drifted = structuredClone(contract);
      mutate(drifted);
      expect(() => assertDpiProvenanceContract(drifted)).toThrow(
        "invalid DPI provenance contract",
      );
    }

    const extra = structuredClone(contract) as unknown as Record<string, unknown>;
    extra.reader_command = "SELECT *";
    expect(() => assertDpiProvenanceContract(extra)).toThrow("closed contract schema");
  });
});
