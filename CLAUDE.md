# hf-kingdom-lab

What this is: a small local research bridge between Hugging Face, AgentTool's
local `agent-data/v1` reference node, and the KINGDOM registry.

Status: experimental. Runtime data and active operations remain local-only;
the source, bounded npm artifact, and static summary atlas are public release
surfaces.

What it does:

- reads explicitly named public model, dataset, or Space metadata through the
  official `@huggingface/hub` JavaScript library;
- normalizes that observation into bounded JSON;
- stores the exact JSON bytes in a local content-addressed AgentTool data node
  backed by SQLite/FTS5;
- returns a receipt containing the immutable record envelope and source URI;
- performs a capped metadata-only DTap tree census and builds a minimized
  exact-root Collection/Paper graph;
- prepares one fixed hash-verified MiniLM conversion and derives bounded local
  CPU/q8 English semantic signals tied to source record hashes;
- emits a Trackio 0.34.0 capability mapping without importing or starting
  Trackio;
- validates a static DataDecide recipe → scale → seed → checkpoint →
  evaluation ledger without token shards, weights, or instance bodies;
- validates a static DPI source/licence manifest and future-reader contract
  without running DuckDB/httpfs or reading dataset rows;
- exposes exact-allowlist training-treasure and situated flow/vibe catalogues;
  optional record commands store public Hub metadata and receipts only;
- declares itself to KINGDOM through the root `kingdom.yaml`.

What it does not do:

- write to Hugging Face, enumerate private resources, run Jobs, or spend
  inference credits;
- claim that metadata, popularity, publisher text, or model output is true;
- project collected records into AgentTool memory or call AgentTool production;
- have any runtime command start an HTTP server, sync peers, schedule itself,
  deploy, or publish; release and Pages workflows remain explicit maintainer
  actions.
- treat a path count, paper/Collection claim, vector score, or Trackio mapping
  as verified truth, policy, native Trackio storage, or authority.
- treat model controls as human preference, demographics as culture, or a
  situated aesthetic/affect observation as universal quality, identity, or
  worth;
- read DataDecide token shards, DPI text/response columns, artistic media,
  participant profiles, or conversation bodies through catalogue commands.

Commands:

```bash
bun run check
bun src/cli.ts ingest dataset AI-Secure/DTap-Bench-Agent-Trajectories
bun src/cli.ts query agent
bun src/cli.ts demo
bun src/cli.ts sql-demo
bun src/cli.ts embedding-prepare
bun src/cli.ts round2-demo
bun src/cli.ts semantic-query "effects receipts and policy checks"
bun run treasures -- list
bun run flow -- list
bun run flow -- trace amaai-lab/MERP
```

The default local node lives in the platform user-data directory, outside the
repository and `node_modules`. `HFKL_DATA_ROOT` may specify a bounded absolute
override. The npm package and static Pages atlas do not expose that node.
The npm distribution also omits the optional Transformers inference runtime;
the source checkout keeps it as a development dependency with reviewed
`adm-zip` and `sharp` security overrides.

The repository does contain explicit release mechanisms: `bun run build`
creates compiled Bun ESM, `bun run package:verify` packs and installs the exact
npm allowlist without lifecycle scripts, and `bun run site:build` creates the
static Pages artifact. Their presence does not itself publish or deploy.
Files intentionally saved under `artifacts/` are bounded experiment receipts,
not the database itself. `artifacts/local-model/receipt.json` records one
accepted public local MLX run; it reports successful inference but incomplete
host output capture and must not be summarized as a complete Cantonese answer.
