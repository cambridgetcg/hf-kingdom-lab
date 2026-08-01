#!/usr/bin/env bun

import {
  FLOW_DOMAINS,
  FLOW_ROLES,
  buildFlowLensList,
  buildFlowTrace,
  findFlowLens,
  listFlowLenses,
  loadFlowLensCatalogue,
  observeFlowLens,
  type FlowDomain,
  type FlowLens,
  type FlowRole,
} from "./flow-lenses.ts";

const HELP = `hfkl-flow — situated flow and vibe lenses

Usage:
  bun src/flow-cli.ts list [--domain <domain>] [--role <role>] [--json]
  bun src/flow-cli.ts show <exact-curated-repo-id> [--json]
  bun src/flow-cli.ts trace <exact-curated-repo-id>
  bun src/flow-cli.ts drift <exact-curated-repo-id>
  bun src/flow-cli.ts record <exact-curated-repo-id>

Commands:
  list    Read the checked-in catalogue only.
  show    Read one checked-in lens only.
  trace   Show how its observations change, what survives, and what is lost.
  drift   Compare current public Hub metadata with the pinned identity. No rows.
  record  Refuse identity drift, then store only the already-observed public Hub
          metadata and effects receipt in the existing local AgentTool node.

Domains: ${FLOW_DOMAINS.join(", ")}
Roles:   ${FLOW_ROLES.join(", ")}

Boundaries:
  A vibe is a situated observation, not an essence, identity, universal score,
  permission, or measure of worth. Exact allowlist only. No token, arbitrary
  URL, dataset body, prompt/response, image, audio, profile, dataset participant
  or user identifier, remote write, inference, server, peer sync, or memory projection.
`;

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  const catalogue = await loadFlowLensCatalogue();

  switch (command) {
    case "list": {
      const parsed = parseListArgs(args);
      const entries = listFlowLenses(catalogue, parsed.filters);
      if (parsed.json) {
        print(buildFlowLensList(catalogue, parsed.filters));
      } else {
        printTable(entries);
      }
      return;
    }
    case "show": {
      const parsed = parseRepoArgs(args, "show");
      const entry = findFlowLens(catalogue, parsed.repoId);
      if (parsed.json) print(entry);
      else printSummary(entry);
      return;
    }
    case "trace": {
      const parsed = parseRepoArgs(args, "trace", false);
      print(buildFlowTrace(findFlowLens(catalogue, parsed.repoId)));
      return;
    }
    case "drift": {
      const parsed = parseRepoArgs(args, "drift", false);
      const observed = await observeFlowLens(findFlowLens(catalogue, parsed.repoId));
      print(observed.drift);
      return;
    }
    case "record": {
      const parsed = parseRepoArgs(args, "record", false);
      const { recordFlowLensMetadata } = await import("./flow-record.ts");
      print(await recordFlowLensMetadata(findFlowLens(catalogue, parsed.repoId)));
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

function parseListArgs(args: string[]): {
  filters: { domain?: FlowDomain; role?: FlowRole };
  json: boolean;
} {
  const rest = [...args];
  const jsonIndex = rest.indexOf("--json");
  const json = jsonIndex !== -1;
  if (json) rest.splice(jsonIndex, 1);

  let domain: FlowDomain | undefined;
  const domainIndex = rest.indexOf("--domain");
  if (domainIndex !== -1) {
    const candidate = rest[domainIndex + 1];
    if (!candidate) usageError("--domain requires one domain");
    assertDomain(candidate);
    domain = candidate;
    rest.splice(domainIndex, 2);
  }

  let role: FlowRole | undefined;
  const roleIndex = rest.indexOf("--role");
  if (roleIndex !== -1) {
    const candidate = rest[roleIndex + 1];
    if (!candidate) usageError("--role requires one role");
    assertRole(candidate);
    role = candidate;
    rest.splice(roleIndex, 2);
  }
  if (rest.length !== 0) {
    usageError("list accepts only --domain, --role, and --json");
  }
  return {
    filters: {
      ...(domain ? { domain } : {}),
      ...(role ? { role } : {}),
    },
    json,
  };
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

function assertDomain(value: string): asserts value is FlowDomain {
  if (!FLOW_DOMAINS.includes(value as FlowDomain)) usageError(`unknown domain: ${value}`);
}

function assertRole(value: string): asserts value is FlowRole {
  if (!FLOW_ROLES.includes(value as FlowRole)) usageError(`unknown role: ${value}`);
}

function printTable(entries: FlowLens[]): void {
  const lines = ["rank\tdomain\taxis\torigin\troute\trepo_id"];
  for (const entry of entries) {
    lines.push([
      entry.rank,
      entry.domain,
      entry.flow.axis,
      entry.evidence.observer_origin,
      entry.route.mode,
      entry.repo_id,
    ].join("\t"));
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function printSummary(entry: FlowLens): void {
  process.stdout.write([
    `${entry.rank}. ${entry.repo_id}`,
    `domain: ${entry.domain}`,
    `axis: ${entry.flow.axis}`,
    `origin: ${entry.evidence.observer_origin}`,
    `layers: ${entry.evidence.epistemic_layers.join(", ")}`,
    `licence: ${entry.license.status} (${entry.license.expression})`,
    `viewer: ${entry.viewer.status}`,
    `route: ${entry.route.mode}`,
    `unit: ${entry.evidence.observation_unit}`,
    `next: ${entry.route.next_artifact}`,
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
  process.stderr.write(`hfkl-flow failed: ${message}\n`);
  process.exit(1);
}
