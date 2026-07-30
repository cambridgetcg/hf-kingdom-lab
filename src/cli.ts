#!/usr/bin/env bun

import {
  runMcpShieldSql,
  storeDatasetAggregate,
} from "./aggregate.ts";
import {
  assertRepoId,
  assertResourceKind,
  type ResourceKind,
} from "./hub.ts";
import {
  DEFAULT_DATA_ROOT,
  DEMO_RESOURCES,
  ingestResources,
  inspectLab,
  queryLab,
} from "./lab.ts";

const HELP = `hfkl — local Hugging Face × AgentTool × KINGDOM lab

Usage:
  hfkl ingest <model|dataset|space> <repo-id>
  hfkl query <text> [--limit <1-50>]
  hfkl demo
  hfkl sql-demo
  hfkl doctor

Boundaries:
  Public Hub metadata plus one fixed public Parquet aggregate; no Hub token,
  mutation, inference, Jobs, private repo enumeration, AgentTool production
  call, server, peer sync, or memory projection. The local node is
  ${DEFAULT_DATA_ROOT}.
`;

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  switch (command) {
    case "ingest": {
      if (args.length !== 2) usageError("ingest requires a resource type and repo id");
      const [rawKind, repoId] = args as [string, string];
      assertResourceKind(rawKind);
      assertRepoId(repoId);
      const result = await ingestResources({
        root: DEFAULT_DATA_ROOT,
        resources: [{ resource_type: rawKind as ResourceKind, repo_id: repoId }],
      });
      print(result);
      return;
    }
    case "query": {
      if (args.length === 0) usageError("query requires text");
      let limit = 20;
      const limitIndex = args.indexOf("--limit");
      if (limitIndex !== -1) {
        const value = args[limitIndex + 1];
        if (!value || limitIndex !== args.length - 2) usageError("--limit requires one final integer");
        limit = Number(value);
        args.splice(limitIndex, 2);
      }
      if (args.length !== 1) usageError("query text must be one quoted argument");
      print(await queryLab(DEFAULT_DATA_ROOT, args[0]!, limit));
      return;
    }
    case "demo": {
      if (args.length !== 0) usageError("demo accepts no arguments");
      print(await ingestResources({
        root: DEFAULT_DATA_ROOT,
        resources: DEMO_RESOURCES,
      }));
      return;
    }
    case "sql-demo": {
      if (args.length !== 0) usageError("sql-demo accepts no arguments");
      const aggregate = await runMcpShieldSql();
      const stored = await storeDatasetAggregate(DEFAULT_DATA_ROOT, aggregate);
      print({
        node_id: stored.node_id,
        record_id: stored.record.id,
        content_sha256: stored.record.content.sha256,
        aggregate,
      });
      return;
    }
    case "doctor": {
      if (args.length !== 0) usageError("doctor accepts no arguments");
      print(await inspectLab(DEFAULT_DATA_ROOT));
      return;
    }
    case "--help":
    case "-h":
    case "help":
    case undefined:
      process.stdout.write(HELP);
      return;
    default:
      usageError(`unknown command: ${command}`);
  }
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${HELP}`);
  process.exit(2);
}

try {
  await main(Bun.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`hfkl failed: ${message}\n`);
  process.exit(1);
}
