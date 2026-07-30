# Hugging Face Resource Map

This is the practical map for using Hugging Face as a public resource commons
without quietly turning every remote object into trusted KINGDOM state.

## Three integration tiers

| Resource | Good play | AgentTool shape | Current tier |
| --- | --- | --- | --- |
| Hub model/dataset/Space metadata | Catalog exact public repos and revisions | `hf-kingdom-resource/v1` snapshot + run receipt | Implemented |
| Dataset Viewer Parquet + DuckDB | Small, reproducible aggregate analysis | digest-bound `hf-kingdom-dataset-aggregate/v1` | Implemented for MCPShield |
| Repository tree metadata | Revision-pinned inventory without file bodies | bounded aggregate census + completeness marker | Implemented for DTap |
| `datasets` streaming | Iterate large datasets without a full local download | bounded batch receipts and resumable cursors | Next; trajectory privacy gate needed |
| Transformers.js embeddings | Local navigation over minimized evidence | source-bound vectors + model manifest receipt | Implemented for fixed MiniLM CPU/q8 |
| `transformers` / MLX generative weights | Local inference on the M4 Max | model revision + command + timing + output receipt | One accepted MLX run; output capture incomplete |
| Spaces / MCP tools | Graphs, images, audio, and specialist tools | invocation receipt with inputs, outputs, remote effects, quota class | Metadata only in this lab |
| `smolagents` / `tiny-agents` | Prototype tool-using agents | state ledger + preflight policy decision + tool receipt | Research |
| Collections + Papers | Curated reading lists and design inputs | exact-root graph + observation/provenance edges | Implemented for one Collection/two papers |
| Storage Buckets | Fast mutable artifacts or intermediate data | object digest, ETag, region, writer, and retention receipt | Keep out of canonical evidence |
| Jobs | Reproducible remote batch compute | immutable job spec, budget ceiling, logs, artifact digests | Off; explicit authorization required |
| Inference Providers | Remote model calls | provider/model/cost/data-boundary receipt | Off; explicit authorization required |
| Trackio | Local experiment observability | AgentTool-to-run/config/metrics mapping + separate future import receipt | Mapping implemented; runtime off |

Official starting points:

- [`@huggingface/hub`](https://huggingface.co/docs/huggingface.js/hub/README)
- [Dataset Viewer with DuckDB](https://huggingface.co/docs/dataset-viewer/duckdb)
- [datasets streaming](https://huggingface.co/docs/datasets/stream)
- [dataset libraries and Parquet exports](https://huggingface.co/docs/hub/datasets-libraries)
- [Spaces as MCP tools](https://huggingface.co/docs/hub/agents-mcp)
- [agents and agent libraries](https://huggingface.co/docs/hub/agents)
- [Collections](https://huggingface.co/docs/hub/collections)
- [Storage Buckets](https://huggingface.co/docs/hub/storage-buckets)
- [Storage regions](https://huggingface.co/docs/hub/storage-regions)

Collections are mutable curation, not trust attestations. Storage Buckets are
mutable, non-versioned, S3-like storage; use versioned repositories or
digest-bound AgentTool records when provenance and history matter.

## Datasets worth playing with

### MCPShield security scan

[`MCPShield/mcp-security-scan-2026`](https://huggingface.co/datasets/MCPShield/mcp-security-scan-2026)
currently exposes a small Dataset Viewer Parquet export: roughly 6.8K rows,
seven columns, and 1.4 MB. That makes it a good aggregate-only SQL target.

The lab fixes the source URL, caps the download at 5 MB, verifies the byte
digest, and returns only:

- grade;
- repository count;
- average reported score;
- sum of reported finding counts;
- average tool count.

It never returns `target`, `slug`, or raw `findings`. All output is labelled
`unverified_signal`. This matters because
[*Rethinking MCP Security* (arXiv:2607.11086)](https://huggingface.co/papers/2607.11086)
reports substantial cross-scanner inconsistency and fewer than 50% true
positives in its manually checked alert sample.

### DTap agent trajectories

[`AI-Secure/DTap-Bench-Agent-Trajectories`](https://huggingface.co/datasets/AI-Secure/DTap-Bench-Agent-Trajectories)
contains nested trajectory JSON. The Dataset Viewer currently reports no
supported data files, so it must not be treated as a Parquet-ready table.

A bounded public tree inventory is now implemented. At revision
`836caf2fdd78b888ddd14fb62dc038e932e17898`, the normal live run reached the
ten-page/10,000-entry cap. It retained aggregate path counts only and labelled
the result truncated and non-representative.

A useful separate next experiment is a content-minimized subset reader:

1. select a small, explicitly named subset;
2. record path, byte size, repository revision, and digest;
3. normalize tool calls, policy checks, and side effects into separate
   records;
4. compare those traces with AgentTool Collab reports and receipts;
5. keep participant content minimized and untrusted until reviewed.

The existing census does not authorize or perform these five body-reading
steps.

### Papers as design inputs

[`LedgerAgent` (arXiv:2606.20529)](https://huggingface.co/papers/2606.20529)
separates observed task state into a ledger and checks state-dependent policy
constraints before environment-changing tool calls. That maps cleanly to a
future AgentTool flow:

```text
observation -> state fact -> proposed call -> policy preflight
            -> allow / refuse / request authority -> effects receipt
```

The paper is a design input, not proof that this lab already implements a
policy engine. Today the lab records effects after bounded operations and
prevents several unsafe input classes in code.

## Local MLX experiment

The first and only run of
[`mlx-community/gpt-oss-20b-MXFP4-Q8`](https://huggingface.co/mlx-community/gpt-oss-20b-MXFP4-Q8)
used public weights at revision
`773a7da77e569019bb0fd17a554b263738d669a3`, with both common Hugging Face
token environment names explicitly unset for the child. Local generation
reached 125.657 tokens/second for 96 tokens with a 12.246 GB MLX-reported
peak. The normal Hub cache grew by roughly 12 GiB; no model bytes were copied
into this repository.

The completed terminal page was host-truncated, so the saved result contains
only a trailing English fragment. It appears to be planning text, but that is
an inference rather than an observed output-channel marker. Exit status and
performance are verified; answer quality is not. The run was deliberately not
repeated. This is also a useful AgentTool lesson: execution success, output
capture, and task success are separate facts and belong in separate receipt
fields.

The model is an `mlx-community` conversion. Its public repository, license
metadata, and successful local loading do not amount to Hugging Face security
review or KINGDOM trust.

## Libraries and how they fit

- `@huggingface/hub`: the narrow JavaScript client used here for public repo
  metadata. Best fit for discovery and revision-aware inventory.
- `datasets`: Arrow-backed loading, transforms, and streaming. Best fit for a
  later bounded trajectory pipeline; use explicit revisions and batch limits.
- DuckDB: local SQL over Parquet. Best fit for aggregation where row-level
  data should not enter AgentTool search.
- `@huggingface/transformers`: JavaScript/WASM/native-ONNX inference. The lab
  pins 4.2.0 and one 23.7 MB community MiniLM conversion for local English
  navigation; model loading is network-trapped after hash verification.
- `transformers`: general Python model loading and inference. On this Mac,
  MLX-native weights and `mlx-lm` remain the better first local
  text-generation path; Python Transformers remains valuable for model
  families and tasks not available in MLX.
- `diffusers`: image/audio/video diffusion pipelines. Prefer local execution
  when supported; a remote Space requires a separate data/quota receipt.
- `peft` and `trl`: adaptation and post-training. They belong in an isolated,
  revision-pinned experiment with a dataset licence review and a compute
  budget, not in this metadata collector.
- `smolagents` and `tiny-agents`: useful agent runtimes, but tool access must
  remain behind the same explicit input, policy, authority, and receipt
  boundary used by AgentTool Collab.
- `trackio`: run/config/numeric-metric observability. The current bridge emits
  a deterministic capability mapping only. Native SQLite/Parquet layout,
  runtime import, hardware logging, dashboard, MCP, and HF sync are all
  explicitly false and need a separate validator/receipt if ever enabled.

## KINGDOM route

This repository's `kingdom.yaml` classifies the lab as `infra` in the
`nervous` layer:

```text
HF commons -> bounded evidence intake -> AgentTool DataNode
           -> reviewable receipts -> KINGDOM discovery
```

Promotion beyond the lab should be a deliberate decision:

- keep raw remote assertions outside canonical truth;
- retain revisions, hashes, observation times, and effect boundaries;
- require a human/agent review before a dataset becomes a policy source;
- require scoped authorization for private data, remote inference, Jobs,
  publication, or bucket writes;
- never infer dignity, consent, trust, or authority from an account token.
