# Round Two: DTap × Graph × Local Semantics × Trackio

Observed 2026-07-30 on the local M4 Max. This round used public Hugging Face
reads and local CPU inference only. It made no Hub write, private-resource
enumeration, Inference Provider request, Job, Space invocation, Bucket
operation, ZeroGPU call, server, dashboard, MCP service, peer sync, or memory
projection.

## Result

```text
fixed public DTap tree metadata ─┐
                                ├─> immutable AgentTool source records
exact Collection + Paper APIs ──┘             │
                                              ├─> local MiniLM vectors
                                              │      └─> bounded dot-product query
                                              └─> Trackio 0.34.0 concept mapping
                                                     (mapping only; no runtime)

kingdom.yaml discovers the project; it does not activate any of the paths.
```

The live run stored these observations in local
`agent-data/v1` collections:

| Lane | Observed result | Boundary |
| --- | --- | --- |
| DTap census | revision `836caf2fdd78b888ddd14fb62dc038e932e17898`; 10,000 entries; 10 tree pages | stopped at `page_limit`; partial Hub-order counts are not representative; no file body |
| Resource graph | 6 nodes, 3 edges | one exact Collection and two exact Paper APIs under a 15-second deadline; no abstracts, profiles, comments, nested collections, or linked-repository fetch |
| Model prepare | 4 assets, 23,685,047 bytes, manifest SHA-256 `07dbea9de5d2118cc16e01bbfca811e3589bb2dcd8cf5b27bd3ed51489d677d9` | fixed community conversion and commit; cold-run token refusal; per-file size/hash verification |
| Local inference | 384 dimensions, L2 norm `1`, first smoke in 853 ms | CPU/q8, mean pooling, 256-wordpiece cap, Transformers.js remote loading and fetch disabled |
| Semantic corpus | 7 source-bound vectors | English lane, derived/unverified signal, at most 64 stored vectors in a local scan |
| Trackio bridge | target `0.34.0`, two metric steps | canonical mapping only; Trackio was not imported and no native database/dashboard/MCP/sync was started |

For the query:

> tool side effects, policy checks, receipts, and security evidence

the first five cosine results were:

| Rank | Source fragment | Score |
| ---: | --- | ---: |
| 1 | `paper:2606.20529` — LedgerAgent | 0.387810 |
| 2 | `local-component:effects-receipt-preflight` | 0.345653 |
| 3 | `local-component:scanner-signal-ledger` | 0.296776 |
| 4 | `paper:2607.11086` — MCP scanner reliability study | 0.289262 |
| 5 | DTap path-census summary | 0.246184 |

This ranking is useful navigation evidence. It is not a factual endorsement,
policy decision, vulnerability result, safety grade, authorship claim, or
measure of participant worth.

The bounded machine-readable summary is
[`artifacts/round2/live-evidence-20260730.json`](https://github.com/cambridgetcg/hf-kingdom-lab/blob/main/artifacts/round2/live-evidence-20260730.json).
It preserves AgentTool record IDs/content hashes and effect non-claims without
copying the seven 384-value vectors into Git.

## Protocols and AgentTool collections

| Collection | Canonical protocol |
| --- | --- |
| `hf-dtap-path-censuses-v1` | `hf-kingdom-dtap-path-census/v1` |
| `hf-resource-graphs-v1` | `hf-kingdom-resource-graph/v1` |
| `hf-embedding-prepare-receipts-v1` | `hf-kingdom-embedding-prepare/v1` |
| `hf-semantic-vectors-v1` | `hf-kingdom-semantic-vector/v1` |
| `hf-trackio-mappings-v1` | `hf-kingdom-trackio-adapter/v1` |

Every semantic vector names the immutable AgentTool source record and content
SHA-256 it was derived from. Collection and query resolve that envelope,
allowlist its evidence collection, and compare its content SHA-256. Search
scans at most 64 records, collapses repeated observations to the latest exact
source fragment, and omits the vector itself. The Trackio mapping names all
input record IDs and keeps text/identifiers in config rather than pretending
they are numeric metrics.

AgentTool is the evidence substrate here: local CAS blobs, immutable record
envelopes, SQLite metadata, FTS, and bounded record resolution. It does not
decide whether a paper, Collection, path label, scanner claim, or similarity
score is true.

## Reproduce

```bash
bun install --frozen-lockfile --ignore-scripts
bun run check

# One fixed public model-asset download, about 23.7 MB:
env -u HF_TOKEN -u HF_ACCESS_TOKEN -u HUGGING_FACE_HUB_TOKEN \
  bun run embedding:prepare

# Fixed public metadata reads + local inference + local AgentTool writes:
env -u HF_TOKEN -u HF_ACCESS_TOKEN -u HUGGING_FACE_HUB_TOKEN \
  bun run demo:round2

# No remote read; rehashes the model and scans local semantic records:
bun src/cli.ts semantic-query \
  "state ledger before environment-changing tool calls"
```

The source lockfile pins the development-only `@huggingface/transformers`
4.2.0 runtime while overriding its vulnerable transitive ranges to patched
`adm-zip` 0.6.0 and `sharp` 0.35.3. Bun reported blocked lifecycle scripts for
`onnxruntime-node` and `protobufjs`; no trust command was run. The Darwin arm64
ONNX runtime loaded successfully, the network-trapped local smoke test
completed, and the dependency audit is clean. The npm package omits this
optional semantic runtime because consumers would not inherit root overrides.
These observations verify this checkout and machine, not every future platform
or package build.

The installed `@huggingface/hub` 2.14.4 does not export a Collection helper.
The graph therefore uses a bodyless exact-URL fetch with manual redirect
refusal, response caps, credential-header refusal, and closed response
validation. It does not silently upgrade the dependency or expose an
arbitrary URL surface.

## HF commons: what fits next

The safe expansion pattern is:

```text
exact resource ID
  -> immutable revision where the resource supports one
  -> explicit byte/row/page/time cap
  -> minimized untrusted observation
  -> AgentTool source record + effects receipt
  -> review before any KINGDOM policy or canonical-truth use
```

Good next local/read-only experiments:

- Dataset Viewer `/splits`, `/size`, and Parquet metadata for one fixed public
  dataset, without `/rows`, search, filtering, or raw participant content.
- `datasets` streaming for a separately selected tiny DTap subset, with an
  immutable revision, byte/file cap, content minimization, and a participant
  privacy review before trajectory bodies enter the lab.
- revision-pinned model-card/library compatibility inventories for
  Transformers, MLX, Diffusers, PEFT, and TRL; metadata compatibility is not
  permission to download large weights or train.
- a local Graphify-compatible JSON export generated from the already stored
  graph, without sending the graph to a remote Space.
- an isolated, separately receipted Trackio runtime validator with hardware
  logging explicitly disabled. That would be a new local mutation and is not
  implied by the mapping implemented here.

Actions still requiring separate explicit authorization include Hub
publication, Dataset/Bucket/Space writes, Jobs, paid/remote inference,
production deployment, external messages, and any private-resource access.
