#!/usr/bin/env bun

import {
  TREASURE_PHASES,
  buildTreasureList,
  findTreasure,
  listTreasures,
  loadTreasureCatalogue,
  observeTreasure,
  type DatasetTreasure,
  type TreasurePhase,
} from "./treasures.ts";

const HELP = `hfkl-treasures — phase-aware Hugging Face dataset archaeology

Usage:
  bun src/treasure-cli.ts list [--phase <phase>] [--json]
  bun src/treasure-cli.ts show <exact-curated-repo-id> [--json]
  bun src/treasure-cli.ts drift <exact-curated-repo-id>
  bun src/treasure-cli.ts record <exact-curated-repo-id>

Commands:
  list    Read the checked-in catalogue only.
  show    Read one checked-in treasure card only.
  drift   Read current public Hub metadata and compare identity fields to the
          pinned card. It does not read dataset rows or files.
  record  Fail if identity drift is present, then store that already-observed
          public Hub metadata plus an effects receipt in the existing local
          AgentTool node. It does not store dataset rows or files.

Boundaries:
  Exact allowlist only. No arbitrary URL, token, private repository, dataset
  body, remote write, inference, job, server, peer sync, or memory projection.
  record uses the existing project-local hfkl AgentTool node.

Phases:
  ${TREASURE_PHASES.join("\n  ")}
`;

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  const catalogue = await loadTreasureCatalogue();

  switch (command) {
    case "list": {
      const parsed = parseListArgs(args);
      const entries = listTreasures(catalogue, parsed.phase);
      if (parsed.json) {
        print(buildTreasureList(catalogue, parsed.phase));
      } else {
        printTable(entries);
      }
      return;
    }
    case "show": {
      const parsed = parseRepoArgs(args, "show");
      const treasure = findTreasure(catalogue, parsed.repoId);
      if (parsed.json) {
        print(treasure);
      } else {
        printSummary(treasure);
      }
      return;
    }
    case "drift": {
      const parsed = parseRepoArgs(args, "drift", false);
      const treasure = findTreasure(catalogue, parsed.repoId);
      const observed = await observeTreasure(treasure);
      print(observed.drift);
      return;
    }
    case "record": {
      const parsed = parseRepoArgs(args, "record", false);
      const treasure = findTreasure(catalogue, parsed.repoId);
      const { recordTreasureMetadata } = await import("./treasure-record.ts");
      print(await recordTreasureMetadata(treasure));
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

function parseListArgs(args: string[]): { phase?: TreasurePhase; json: boolean } {
  const rest = [...args];
  const jsonIndex = rest.indexOf("--json");
  const json = jsonIndex !== -1;
  if (json) rest.splice(jsonIndex, 1);

  let phase: TreasurePhase | undefined;
  const phaseIndex = rest.indexOf("--phase");
  if (phaseIndex !== -1) {
    const candidate = rest[phaseIndex + 1];
    if (!candidate) usageError("--phase requires one phase name");
    assertPhase(candidate);
    phase = candidate;
    rest.splice(phaseIndex, 2);
  }
  if (rest.length !== 0) usageError("list accepts only --phase and --json");
  return { ...(phase ? { phase } : {}), json };
}

function parseRepoArgs(
  args: string[],
  command: string,
  allowJson = true,
): { repoId: string; json: boolean } {
  const rest = [...args];
  const jsonIndex = rest.indexOf("--json");
  const json = jsonIndex !== -1;
  if (json && !allowJson) usageError(`${command} does not accept --json`);
  if (json) rest.splice(jsonIndex, 1);
  if (rest.length !== 1 || !rest[0]) {
    usageError(`${command} requires one exact curated repo id`);
  }
  return { repoId: rest[0]!, json };
}

function assertPhase(value: string): asserts value is TreasurePhase {
  if (!TREASURE_PHASES.includes(value as TreasurePhase)) {
    usageError(`unknown phase: ${value}`);
  }
}

function printTable(entries: DatasetTreasure[]): void {
  const lines = ["rank\tphase\troute\trepo_id"];
  for (const entry of entries) {
    lines.push([
      entry.rank,
      entry.phase,
      entry.kingdom_route.mode,
      entry.repo_id,
    ].join("\t"));
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function printSummary(entry: DatasetTreasure): void {
  process.stdout.write([
    `${entry.rank}. ${entry.repo_id}`,
    `phase: ${entry.phase}`,
    `revision: ${entry.revision}`,
    `licence: ${entry.license.status}${entry.license.expression ? ` (${entry.license.expression})` : ""}`,
    `viewer: ${entry.viewer.status}`,
    `route: ${entry.kingdom_route.mode}`,
    `treasure: ${entry.treasure}`,
    `next: ${entry.kingdom_route.next_artifact}`,
    "",
  ].join("\n"));
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
  process.stderr.write(`hfkl-treasures failed: ${message}\n`);
  process.exit(1);
}
