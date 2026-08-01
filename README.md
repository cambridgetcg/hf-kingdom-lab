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

fixed DTap tree + exact Collection/Paper roots
  -> capped metadata-only census + provenance graph
  -> hash-verified local MiniLM CPU/q8 embeddings
  -> bounded semantic scan + Trackio capability mapping
  -> separate AgentTool evidence collections

pinned training/data archaeology
  -> DataDecide recipe -> scale -> seed -> checkpoint -> evaluation ledger
  -> DPI source/licence manifest and fail-closed future-reader contract
  -> situated artistic/conversation/music flow lenses
  -> optional exact metadata-only AgentTool receipt
```

It does **not** start a service, call AgentTool production, project anything
into memory, enumerate private repositories, invoke a Space, submit a Job, use
Inference Providers, or write to Hugging Face.

The archaeology lane also contains no training token shards, checkpoint
weights, evaluation-instance archives, DPI text, prompts/responses, images,
audio, participant profiles, or verbatim/full remote dataset rows. The
DataDecide ledger intentionally retains two normalized aggregate-result
witnesses with exact source coordinates.

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
- pinned the public DTap tree at revision
  `836caf2fdd78b888ddd14fb62dc038e932e17898`, counted 10,000 path entries,
  and stopped at the ten-page limit without reading a trajectory body;
- observed one exact public MCP Security Collection and two exact Paper Pages
  as a six-node, three-edge graph while discarding abstracts, author profiles,
  comments, and linked-repository bodies;
- downloaded and rehashed four fixed files for
  `Xenova/all-MiniLM-L6-v2@751bff3…`, then ran 384-dimensional CPU/q8
  feature extraction locally with the Transformers.js network transport
  disabled;
- indexed seven source-bound semantic fragments and mapped the run to
  Trackio 0.34.0 concepts without importing Trackio, writing native Trackio
  storage, starting hardware logging, a dashboard, MCP, or Hugging Face sync.

See [docs/ROUND2.md](docs/ROUND2.md) for the exact live result and
[bounded live evidence](artifacts/round2/live-evidence-20260730.json) for the
record IDs, hashes, effects, and limitations. DTap's 10,000-entry result is
Hub-order partial and explicitly not a representative dataset distribution.
Semantic similarity is a derived English-language signal, not a truth or
safety decision.

The saved SQL evidence snapshot is
[artifacts/hf/mcpshield-grade-aggregate-20260730-direct-python.json](artifacts/hf/mcpshield-grade-aggregate-20260730-direct-python.json).
Scanner grades are evidence to investigate, not established vulnerabilities.
The associated MCP security study reports that fewer than half of sampled
scanner alerts survived manual validation.

The companion
[artifacts/hf/public-resource-ingest-20260730.json](artifacts/hf/public-resource-ingest-20260730.json)
is the exact effects receipt and record index for the four-resource Hub run.

## Training decisions, provenance, and situated flow

The 2026-08-01 deep pass turns three promising research seams into bounded
local artifacts:

- the [DataDecide phase ledger](docs/DATADECIDE-LEDGER.md) preserves exact
  recipe aliases, all 14 scales, five seed identities, branch-qualified
  checkpoint witnesses, and evaluation joins without mirroring roughly 19 TB
  of token shards or 123 GB of instance evaluations;
- the [DPI provenance contract](docs/DPI-PROVENANCE.md) pins the three source
  exports, ten Viewer Parquet shards, nested provenance schema, immutable
  revisions, count discrepancy, column boundary, and prerequisites for a
  future aggregate reader. No reader is implemented because the current
  DuckDB/httpfs boundary cannot yet enforce the claimed network-byte ceiling;
- the [flow and vibe atlas](docs/FLOW-AND-VIBE.md) maps ten writing, visual-art,
  music, and conversation artifacts across pair, turn, branch, culture/language,
  observer, region, rubric, perspective, and time-series shapes.

The flow atlas treats a vibe as a situated observation rather than an essence
or universal score. It machine-separates human, model, and mixed evidence;
descriptive, normative, and control lanes; component licences; identity
surfaces; Viewer mismatches; and what each transformation preserves or loses.
Its exact-allowlist `record` command stores a newly reconstructed narrow copy
of current public Hub metadata and an effects receipt only.

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
bun install --frozen-lockfile --ignore-scripts
uv sync --frozen

bun run check
bun run demo
bun src/cli.ts query agent --limit 10
bun run demo:sql
bun run embedding:prepare
bun run demo:round2
bun src/cli.ts semantic-query \
  "tool side effects, policy checks, receipts, and security evidence"
bun src/cli.ts doctor

bun run treasures -- list
bun run flow -- list
bun run flow -- trace amaai-lab/MERP
```

`embedding:prepare` is the only model-asset network step. It accepts no model
or URL argument, refuses the common ambient Hugging Face token variables on a
cold run, downloads a fixed 23,685,047-byte manifest, and verifies each
SHA-256 before an atomic local install. A warm prepare rehashes local files and
performs no read. Semantic commands then set Transformers.js remote loading
off and replace its fetch transport with a failing network trap.

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
- The DTap path performs metadata/tree reads only. Its normal cap is 10 pages,
  10,000 entries, 6 MiB of tree response bodies, 4 MiB of normalized path
  bytes, and 15 seconds. Cap-stopped counts are retained only with an explicit
  truncated/non-representative marker.
- The graph accepts one exact Collection URL and two exact Paper API URLs. A
  Collection is mutable curation, and paper titles/membership remain untrusted
  observations. One shared 15-second deadline covers transport and bounded
  response-body reads.
- The MiniLM weights are an Apache-2.0 community conversion rather than a
  security-reviewed publisher build. The semantic lane is English-oriented,
  capped at 256 wordpieces per text and 64 locally scanned vectors; AgentTool
  FTS remains the general/Cantonese search path. Collection and query both
  resolve every named source record and compare its envelope content SHA-256;
  only one network-trapped embedder may be active in a process.
- The Trackio document targets the public 0.34.0 run/config/numeric-metric
  concepts only. It is not a Trackio-validated database, runtime, dashboard,
  MCP service, or sync receipt.
- AgentTool `DataNode` supplies local content-addressed storage, SQLite
  metadata, FTS, and immutable record identities. It does not validate these
  application schemas, enforce the declared `private` visibility label,
  verify signatures, decide truth, synchronize peers, or physically erase
  content.
- The aggregate path validates an exact closed document schema before
  collection. Arbitrary URLs, SQL, datasets, and row-level output are not
  accepted.
- The DataDecide ledger is checked-in, static evidence. It retains exact alias
  joins and branch target SHAs, but its bounded checkpoint/evaluation rows are
  witnesses rather than a materialized copy of all 31,404 revisions or 1.41M
  result rows.
- The DPI module is a static contract, not a dataset reader. Hub LFS hashes are
  publisher/Hub assertions because the 1.23 GB source and 1.89 GB conversion
  were not downloaded and rehashed. A future range reader must also account
  honestly for text min/max statistics present in Parquet footers.
- Flow-lens `list`, `show`, and `trace` are local. `drift` reads one exact public
  dataset's metadata; `record` refuses identity drift and stores that same
  metadata only. A future content route still needs the listed licence,
  privacy, representation, and aggregate gates.
- The KINGDOM card makes this lab discoverable as a local `nervous`-layer
  project. It does not register a production runtime or grant authority over
  AgentTool, KINGDOM, Hugging Face, or any participant.
- `RIGHTS.md` adopts `xenia.rights/0.1`. Rights, account permissions, and
  authorization remain distinct.

See [docs/HF-RESOURCE-MAP.md](docs/HF-RESOURCE-MAP.md) for the wider playground
and [docs/INTEGRATION.md](docs/INTEGRATION.md) for the bridge contract.
