# hf-kingdom-lab

What this is: a small local research bridge between Hugging Face, AgentTool's
local `agent-data/v1` reference node, and the KINGDOM registry.

Status: experimental and local-only.

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
- declares itself to KINGDOM through the root `kingdom.yaml`.

What it does not do:

- write to Hugging Face, enumerate private resources, run Jobs, or spend
  inference credits;
- claim that metadata, popularity, publisher text, or model output is true;
- project collected records into AgentTool memory or call AgentTool production;
- start an HTTP server, sync peers, schedule itself, deploy, or publish.
- treat a path count, paper/Collection claim, vector score, or Trackio mapping
  as verified truth, policy, native Trackio storage, or authority.

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
```

The default local node lives at `.hf-kingdom-data/` and is ignored by Git.
Files intentionally saved under `artifacts/` are bounded experiment receipts,
not the database itself. `artifacts/local-model/receipt.json` records one
accepted public local MLX run; it reports successful inference but incomplete
host output capture and must not be summarized as a complete Cantonese answer.
