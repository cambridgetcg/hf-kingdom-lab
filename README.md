# Hugging Face × AgentTool × KINGDOM Lab

A local-first, public-read playground for turning selected Hugging Face
resources into searchable AgentTool evidence and a KINGDOM-discoverable
project.

The working path is deliberately small:

```text
named public HF resource
  -> bounded @huggingface/hub observation
  -> canonical JSON snapshot + explicit boundary
  -> AgentTool agent-data/v1 CAS + SQLite/FTS
  -> immutable run receipt
  -> KINGDOM project card

fixed public Parquet export
  -> bounded temporary download + SHA-256
  -> fixed aggregate-only DuckDB query
  -> closed-schema validation
  -> AgentTool aggregate record
```

It does **not** start a service, call AgentTool production, project anything
into memory, enumerate private repositories, invoke a Space, submit a Job, use
Inference Providers, or write to Hugging Face.

## What works

As of 2026-07-30, the live demos have:

- observed four explicitly named public Hub resources without supplying a
  token: two datasets, one model, and one Space;
- stored their normalized snapshots and a separate effects receipt in a local
  AgentTool `DataNode`;
- queried those records through the node's local FTS index;
- downloaded one 1,382,608-byte public Parquet export into a bounded temporary
  file, verified its Parquet framing and SHA-256, and ran a fixed DuckDB
  aggregate;
- stored only five grade-level aggregate rows, not repository identifiers or
  raw scanner findings.

The saved SQL evidence snapshot is
[artifacts/hf/mcpshield-grade-aggregate-20260730-direct-python.json](artifacts/hf/mcpshield-grade-aggregate-20260730-direct-python.json).
Scanner grades are evidence to investigate, not established vulnerabilities.
The associated MCP security study reports that fewer than half of sampled
scanner alerts survived manual validation.

The companion
[artifacts/hf/public-resource-ingest-20260730.json](artifacts/hf/public-resource-ingest-20260730.json)
is the exact effects receipt and record index for the four-resource Hub run.

## Local 20B result

One public, unauthenticated MLX run of
[`mlx-community/gpt-oss-20b-MXFP4-Q8`](https://huggingface.co/mlx-community/gpt-oss-20b-MXFP4-Q8)
completed locally on the M4 Max at revision
`773a7da77e569019bb0fd17a554b263738d669a3`:

- 12,104,215,835 snapshot bytes across ten independently rehashed files;
- 96 generated tokens at 125.657 tokens/second;
- 12.246 GB MLX-reported peak memory;
- 2,343.96 seconds wall time including the first public download;
- no authenticated Hub request, Inference Provider, ZeroGPU, Job, Space call,
  upload, daemon, port, or HF credit/quota use.

The process exited 0, but the host truncated the completed PTY page. Only a
trailing English fragment was recoverable. It appears to be planning text, but
that is an inference rather than an observed output-channel marker. The
evidence explicitly does **not** claim a complete Cantonese answer, and the run
was not repeated to manufacture a cleaner result.

See the [run receipt](artifacts/local-model/receipt.json),
[metrics and model file hashes](artifacts/local-model/metrics.json), and
[bounded recovered output](artifacts/local-model/selected-output.txt).

## Run it

Requirements: Bun 1.3+, `uv`, and network access to the public Hugging Face
resource being observed.

```bash
bun install --ignore-scripts
uv sync --frozen

bun run check
bun run demo
bun src/cli.ts query agent --limit 10
bun run demo:sql
bun src/cli.ts doctor
```

`uv sync --frozen` is an explicit setup step: on a fresh checkout it creates
the project `.venv` and may contact the configured Python package index to
install the locked DuckDB wheel. `sql-demo` then executes that environment's
Python directly; it does not run `uv`, sync dependencies, or contact a package
index as part of the recorded aggregate operation.

Observe one additional named public repository:

```bash
bun src/cli.ts ingest dataset AI-Secure/DTap-Bench-Agent-Trajectories
```

Local records live under `.hf-kingdom-data/`, which is ignored by Git. The
demo's public metadata and source bytes can change over time, so every stored
document carries its observation time or source digest.

## Honest boundaries

- `@huggingface/hub` is used directly for public model, dataset, and Space
  metadata. The adapter supplies no access token and rejects a private
  response, but that is an application boundary rather than a provider-wide
  anonymity guarantee.
- AgentTool `DataNode` supplies local content-addressed storage, SQLite
  metadata, FTS, and immutable record identities. It does not validate these
  application schemas, enforce the declared `private` visibility label,
  verify signatures, decide truth, synchronize peers, or physically erase
  content.
- The aggregate path validates an exact closed document schema before
  collection. Arbitrary URLs, SQL, datasets, and row-level output are not
  accepted.
- The KINGDOM card makes this lab discoverable as a local `nervous`-layer
  project. It does not register a production runtime or grant authority over
  AgentTool, KINGDOM, Hugging Face, or any participant.
- `RIGHTS.md` adopts `xenia.rights/0.1`. Rights, account permissions, and
  authorization remain distinct.

See [docs/HF-RESOURCE-MAP.md](docs/HF-RESOURCE-MAP.md) for the wider playground
and [docs/INTEGRATION.md](docs/INTEGRATION.md) for the bridge contract.
