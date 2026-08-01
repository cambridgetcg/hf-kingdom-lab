import { isAbsolute, resolve } from "node:path";
import {
  canonicalJson,
  type DataNode,
  type JsonObject,
  type RecordEnvelope,
} from "@agenttool/data";
import {
  AGGREGATE_COLLECTION,
  openLabNode,
} from "./store.ts";

export const MCP_SHIELD_DATASET = "MCPShield/mcp-security-scan-2026";
export const MCP_SHIELD_URL = "https://huggingface.co/datasets/MCPShield/mcp-security-scan-2026/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet";
export const PROJECT_PYTHON = resolveProjectPython();

export function resolveProjectPython(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const explicit = env.HFKL_PYTHON;
  if (explicit !== undefined) {
    if (
      explicit.length === 0
      || explicit.length > 4_096
      || explicit.includes("\0")
      || !isAbsolute(explicit)
    ) {
      throw new TypeError("HFKL_PYTHON must be a bounded absolute path");
    }
    return resolve(explicit);
  }
  return resolve(import.meta.dir, "..", ".venv", "bin", "python");
}
export const MCP_SHIELD_QUERY = [
  "SELECT",
  "  grade,",
  "  count(*)::BIGINT AS repository_count,",
  "  round(avg(score), 2) AS average_score,",
  "  sum(findingCount)::BIGINT AS reported_finding_count,",
  "  round(avg(toolCount), 2) AS average_tool_count",
  "FROM read_parquet(?)",
  "GROUP BY grade",
  "ORDER BY grade",
].join("\n");

export interface AggregateRow {
  grade: string;
  repository_count: number;
  average_score: number | null;
  reported_finding_count: number;
  average_tool_count: number | null;
}

export interface DatasetAggregate {
  protocol: "hf-kingdom-dataset-aggregate/v1";
  observed_at: string;
  source: {
    dataset_id: typeof MCP_SHIELD_DATASET;
    url: typeof MCP_SHIELD_URL;
    bytes: number;
    sha256: string;
  };
  query: typeof MCP_SHIELD_QUERY;
  rows: AggregateRow[];
  classification: "unverified_signal";
  tools: {
    duckdb: string;
    python: string;
  };
  effects: {
    remote_reads: [typeof MCP_SHIELD_URL];
    remote_writes: [];
    local_temporary_file: true;
    temporary_file_removed: true;
  };
  limits: string[];
}

export async function runMcpShieldSql(): Promise<DatasetAggregate> {
  const script = resolve(import.meta.dir, "mcpshield_sql.py");
  if (!(await Bun.file(PROJECT_PYTHON).exists())) {
    throw new Error(
      "SQL demo Python is missing; in a source checkout run `uv sync --frozen`, or set HFKL_PYTHON to an authorized absolute Python path with the locked DuckDB dependencies",
    );
  }
  const process = Bun.spawn(sqlSubprocessCommand(script), {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    const summary = stderr.trim().split("\n").at(-1) ?? "unknown failure";
    throw new Error(`DuckDB subprocess failed: ${summary}`);
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(stdout);
  } catch {
    throw new Error("DuckDB subprocess returned invalid JSON");
  }
  return validateDatasetAggregate(decoded);
}

export function sqlSubprocessCommand(script: string): [string, string] {
  return [PROJECT_PYTHON, script];
}

export async function storeDatasetAggregate(
  root: string,
  aggregate: DatasetAggregate,
): Promise<{ node_id: string; record: RecordEnvelope }> {
  const node = await openLabNode(root);
  try {
    return {
      node_id: node.node_id,
      record: await collectAggregate(node, aggregate),
    };
  } finally {
    node.close();
  }
}

export function validateDatasetAggregate(value: unknown): DatasetAggregate {
  const object = exactObject(value, [
    "classification",
    "effects",
    "limits",
    "observed_at",
    "protocol",
    "query",
    "rows",
    "source",
    "tools",
  ]);
  if (object.protocol !== "hf-kingdom-dataset-aggregate/v1") fail("invalid protocol");
  if (object.classification !== "unverified_signal") fail("invalid classification");
  if (object.query !== MCP_SHIELD_QUERY) fail("query did not match the fixed aggregate SQL");
  if (!isIsoDate(object.observed_at)) fail("invalid observed_at");

  const source = exactObject(object.source, ["bytes", "dataset_id", "sha256", "url"]);
  if (source.dataset_id !== MCP_SHIELD_DATASET || source.url !== MCP_SHIELD_URL) {
    fail("source did not match the fixed public dataset");
  }
  if (!isIntegerInRange(source.bytes, 1, 5_000_000)) fail("invalid source byte count");
  if (typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256)) {
    fail("invalid source digest");
  }

  if (!Array.isArray(object.rows) || object.rows.length === 0 || object.rows.length > 20) {
    fail("invalid aggregate rows");
  }
  const rows = object.rows.map((row) => validateRow(row));

  const tools = exactObject(object.tools, ["duckdb", "python"]);
  if (!isBoundedString(tools.duckdb, 1, 40) || !isBoundedString(tools.python, 1, 40)) {
    fail("invalid tool versions");
  }

  const effects = exactObject(object.effects, [
    "local_temporary_file",
    "remote_reads",
    "remote_writes",
    "temporary_file_removed",
  ]);
  if (
    effects.local_temporary_file !== true
    || effects.temporary_file_removed !== true
    || !Array.isArray(effects.remote_writes)
    || effects.remote_writes.length !== 0
    || !Array.isArray(effects.remote_reads)
    || effects.remote_reads.length !== 1
    || effects.remote_reads[0] !== MCP_SHIELD_URL
  ) {
    fail("invalid effect boundary");
  }
  if (
    !Array.isArray(object.limits)
    || object.limits.length === 0
    || object.limits.length > 20
    || !object.limits.every((limit) => isBoundedString(limit, 1, 300))
  ) {
    fail("invalid limits");
  }

  return {
    protocol: "hf-kingdom-dataset-aggregate/v1",
    observed_at: object.observed_at as string,
    source: {
      dataset_id: MCP_SHIELD_DATASET,
      url: MCP_SHIELD_URL,
      bytes: source.bytes as number,
      sha256: source.sha256 as string,
    },
    query: MCP_SHIELD_QUERY,
    rows,
    classification: "unverified_signal",
    tools: {
      duckdb: tools.duckdb as string,
      python: tools.python as string,
    },
    effects: {
      remote_reads: [MCP_SHIELD_URL],
      remote_writes: [],
      local_temporary_file: true,
      temporary_file_removed: true,
    },
    limits: [...object.limits] as string[],
  };
}

async function collectAggregate(
  node: DataNode,
  aggregate: DatasetAggregate,
): Promise<RecordEnvelope> {
  const response = await node.collect({
    collection_id: AGGREGATE_COLLECTION,
    collector_id: "text",
    input: {
      text: canonicalJson(aggregate),
      media_type: "application/json",
      source_uri: MCP_SHIELD_URL,
      external_id: `${MCP_SHIELD_DATASET}:default/train`,
      key: `${MCP_SHIELD_DATASET}:grade-aggregate`,
      version: aggregate.source.sha256,
      observed_at: aggregate.observed_at,
      metadata: {
        document_type: "dataset-aggregate",
        dataset_id: MCP_SHIELD_DATASET,
        classification: aggregate.classification,
      },
      provenance: [
        {
          activity: "aggregate-query",
          at: aggregate.observed_at,
          actor: `duckdb:${aggregate.tools.duckdb}`,
          input_ids: [aggregate.source.sha256],
        },
      ],
    } satisfies JsonObject,
  });
  const record = response.records[0];
  if (!record) throw new Error("AgentTool data node returned no aggregate record");
  return record;
}

function validateRow(value: unknown): AggregateRow {
  const row = exactObject(value, [
    "average_score",
    "average_tool_count",
    "grade",
    "reported_finding_count",
    "repository_count",
  ]);
  if (!isBoundedString(row.grade, 1, 40)) fail("invalid grade");
  if (!isIntegerInRange(row.repository_count, 0, 100_000)) fail("invalid repository count");
  if (!isIntegerInRange(row.reported_finding_count, 0, 10_000_000)) {
    fail("invalid finding count");
  }
  if (!isNullableFiniteNumber(row.average_score) || !isNullableFiniteNumber(row.average_tool_count)) {
    fail("invalid average");
  }
  return {
    grade: row.grade,
    repository_count: row.repository_count,
    average_score: row.average_score,
    reported_finding_count: row.reported_finding_count,
    average_tool_count: row.average_tool_count,
  };
}

function exactObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("expected object");
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("object fields did not match the closed schema");
  }
  return object;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function fail(message: string): never {
  throw new TypeError(`invalid aggregate document: ${message}`);
}
