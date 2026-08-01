import { describe, expect, test } from "bun:test";
import {
  MCP_SHIELD_DATASET,
  MCP_SHIELD_QUERY,
  MCP_SHIELD_URL,
  PROJECT_PYTHON,
  resolveProjectPython,
  sqlSubprocessCommand,
  validateDatasetAggregate,
} from "../src/aggregate.ts";

function validDocument(): unknown {
  return {
    protocol: "hf-kingdom-dataset-aggregate/v1",
    observed_at: "2026-07-30T12:00:00.000Z",
    source: {
      dataset_id: MCP_SHIELD_DATASET,
      url: MCP_SHIELD_URL,
      bytes: 1_400_000,
      sha256: "a".repeat(64),
    },
    query: MCP_SHIELD_QUERY,
    rows: [
      {
        grade: "A",
        repository_count: 10,
        average_score: 90.5,
        reported_finding_count: 2,
        average_tool_count: 3.2,
      },
    ],
    classification: "unverified_signal",
    tools: {
      duckdb: "1.5.5",
      python: "3.14.0",
    },
    effects: {
      remote_reads: [MCP_SHIELD_URL],
      remote_writes: [],
      local_temporary_file: true,
      temporary_file_removed: true,
    },
    limits: ["aggregate only"],
  };
}

describe("fixed DuckDB aggregate boundary", () => {
  test("accepts only an explicit absolute Python override", () => {
    expect(resolveProjectPython({ HFKL_PYTHON: "/opt/hfkl/bin/python" }))
      .toBe("/opt/hfkl/bin/python");
    expect(() => resolveProjectPython({ HFKL_PYTHON: "./python" }))
      .toThrow("HFKL_PYTHON must be a bounded absolute path");
  });

  test("accepts the closed aggregate schema", () => {
    expect(validateDatasetAggregate(validDocument())).toMatchObject({
      protocol: "hf-kingdom-dataset-aggregate/v1",
      classification: "unverified_signal",
    });
  });

  test("rejects extra fields and changed SQL", () => {
    expect(() => validateDatasetAggregate({
      ...(validDocument() as Record<string, unknown>),
      surprise: true,
    })).toThrow("closed schema");
    expect(() => validateDatasetAggregate({
      ...(validDocument() as Record<string, unknown>),
      query: "SELECT * FROM secrets",
    })).toThrow("fixed aggregate SQL");
  });

  test("runs the prepared project Python directly instead of invoking uv", () => {
    const command = sqlSubprocessCommand("/tmp/fixed-query.py");
    expect(command).toEqual([PROJECT_PYTHON, "/tmp/fixed-query.py"]);
    expect(command[0]).toEndWith("/.venv/bin/python");
    expect(command).not.toContain("uv");
  });
});
