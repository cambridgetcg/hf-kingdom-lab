# Integration Contract

## Components

`src/hub.ts` observes explicitly named public model, dataset, and Space
metadata through `@huggingface/hub`. It normalizes arrays, rejects malformed
repository IDs and private responses, and marks every assertion untrusted.

`src/store.ts` opens `@agenttool/data` directly in-process. No AgentTool HTTP
server, API key, port, production endpoint, peer sync, or memory projection is
involved.

`src/mcpshield_sql.py` downloads one fixed public Parquet export into a
temporary file, enforces a 5 MB ceiling, checks `PAR1` framing, records its
SHA-256, and executes one fixed aggregate SQL statement with DuckDB. The
TypeScript wrapper calls the already-synced project `.venv/bin/python`
directly. Environment creation and dependency sync are an explicit setup step,
not an undeclared side effect of an aggregate run.

`src/aggregate.ts` accepts only the exact dataset, URL, query, effect boundary,
and closed output schema before storing the result.

`src/dtap.ts` resolves one fixed public DTap dataset revision and walks only
its tree-metadata API. It caps pages, entries, response/path bytes, depth, and
time; never exposes a repository/URL/path argument; never reads `/resolve`
file bodies; and marks normal cap stops partial and non-representative.

`src/graph.ts` reads one exact public Collection and two exact Paper APIs. It
retains minimized nodes, observed Collection-membership edges, and two
explicit local-curation edges. Remote summaries, profiles, comments, nested
Collections, and linked repositories are discarded.
The entire graph observation has a 15-second default deadline; injected tests
may shorten but cannot extend it, and an injected transport that ignores its
AbortSignal is still raced against that deadline.

`src/embedding.ts` owns a four-file, revision-qualified MiniLM asset manifest.
Cold prepare refuses common ambient HF token variables and validates exact
bytes/SHA-256 before atomic installation. Warm prepare rehashes locally.
Inference uses Transformers.js 4.2.0 on CPU/q8 with remote models disabled and
the library fetch transport replaced by a failing network trap. Vectors remain
derived, English-oriented, source-hash-bound evidence.
The collector and bounded query both resolve the AgentTool source record,
allowlist its source collection, and compare the envelope content SHA-256.
Only one local embedder may hold the process-global Transformers.js network
trap at a time; an overlapping construction fails closed.

`src/trackio.ts` maps bounded numeric run metrics and JSON-primitive config to
a versioned Trackio 0.34.0 capability document. It neither imports Trackio nor
writes native Trackio SQLite/Parquet, and it starts no hardware logger,
dashboard, MCP server, or Hugging Face sync.

`src/treasures.ts` validates the phase-aware dataset archaeology catalogue.
Its exact-allowlist drift and record paths read one public Hub metadata object,
validate every retained value, and reconstruct a narrow snapshot for the local
AgentTool resource/receipt path. They never read a curated dataset body merely
because it appears in the atlas.

`src/datadecide.ts` validates a static five-stage
recipe → scale → seed → checkpoint → evaluation ledger. It preserves exact
alias namespaces, branch target SHAs, scientific-versus-operational seed roles,
licence routes, and bounded aggregate witnesses. It performs no network call
and does not include token shards, weights, or evaluation-instance bodies.

`src/dpi-provenance.ts` validates a static provenance contract for the filtered
Data Provenance Initiative artifact. It pins source and conversion identities,
file manifests, schema, count drift, endpoint/column boundaries, and the
prerequisites for a future reader. It is deliberately not a reader: no
DuckDB/httpfs execution or data URL is accepted.

`src/flow-lenses.ts` validates ten situated writing, art, music, and
conversation lenses. Human, model, and mixed origins; descriptive, normative,
and control layers; identity surfaces; licence scope; Viewer representation;
and transformation losses remain separate. `src/flow-cli.ts` is exact-allowlist
only. Its optional record path writes the already-observed public metadata and
normal effects receipt through the existing AgentTool collections; it does not
store prompts, responses, media, profiles, dataset participant/user
identifiers, or dataset rows. Public repository identity is retained.

`kingdom.yaml` is a discovery card. It describes this repository; it does not
activate or deploy it.

The first SQL experiment used plain `uv run`; independent review correctly
identified that a first `uv run` can create or sync `.venv` and contact package
indexes beyond the receipt's declared effects. That immutable AgentTool record
is retained in
`artifacts/hf/mcpshield-grade-aggregate-20260730-uv-run-superseded.json` with
the review reference. The current evidence file comes from the corrected
direct-Python path and is named
`artifacts/hf/mcpshield-grade-aggregate-20260730-direct-python.json`. The
original artifact path and bytes remain unchanged because they were already
referenced by digest in the coordination journal.

## Records

The local node declares eight collections:

| Collection | Canonical content |
| --- | --- |
| `hf-resources-v1` | `hf-kingdom-resource/v1` |
| `hf-run-receipts-v1` | `hf-kingdom-run-receipt/v1` |
| `hf-dataset-aggregates-v1` | `hf-kingdom-dataset-aggregate/v1` |
| `hf-dtap-path-censuses-v1` | `hf-kingdom-dtap-path-census/v1` |
| `hf-resource-graphs-v1` | `hf-kingdom-resource-graph/v1` |
| `hf-embedding-prepare-receipts-v1` | `hf-kingdom-embedding-prepare/v1` |
| `hf-semantic-vectors-v1` | `hf-kingdom-semantic-vector/v1` |
| `hf-trackio-mappings-v1` | `hf-kingdom-trackio-adapter/v1` |

Resource records hold normalized Hub metadata and the observation boundary.
Run receipts independently hold requested resources, effects, local record
IDs, content hashes, and limitations. Aggregate records hold source bytes,
digest, fixed SQL, aggregate rows, tool versions, effects, and limitations.
Round-two records separately hold the DTap census, graph, model-asset receipt,
source-bound vector, and observability mapping. A vector never substitutes for
its named source record.

The DataDecide, DPI, treasure, and flow catalogues are checked-in versioned
evidence, not extra AgentTool collections. A flow/treasure `record` operation
uses `hf-resources-v1` and `hf-run-receipts-v1`; the richer local analysis stays
reviewable in Git and cannot be mistaken for live Hub observation.

The separation is essential. In AgentTool Data 0.3.1, record identity is based
on canonical content and key identity; metadata, `observed_at`, provenance,
and signature fields do not change that identity. A duplicate record keeps
the first envelope. Any fact that must alter evidentiary identity therefore
belongs in canonical JSON content, not only in the envelope.

## Guarantees and non-guarantees

The application currently enforces:

- bounded repository IDs and request counts;
- public-response-only resource observation;
- no supplied Hugging Face token in the Hub adapter;
- canonical JSON content;
- separate effect receipts;
- fixed URL, byte ceiling, fixed SQL, aggregate-only output, and closed-schema
  validation for the DuckDB path;
- fixed DTap identity plus page, entry, byte, depth, and wall-time limits;
- exact graph roots, manual redirect refusal, closed edge relations, and
  minimized retained fields under one 15-second deadline;
- fixed embedding asset paths/sizes/hashes, cold-run credential refusal,
  plain-directory/symlink checks, preallocated exact-size reads,
  256-wordpiece/384-dimension checks, and local-only network-trapped inference;
- bounded 64-record dot-product scans whose result surface omits vectors;
- source-record existence, source-collection allowlist, and source content-hash
  verification during semantic collection and query;
- finite, closed Trackio mapping metrics and explicit runtime non-effects;
- exact pinned DataDecide aliases, stages, branch revisions, evidence drift,
  licence gates, and non-network/static boundaries;
- exact DPI source/conversion identities, asserted manifests, schema/count
  drift, default-deny endpoint/column rules, and false reader-runtime flags;
- non-scalar flow-lens boundaries, explicit observer/epistemic origins,
  privacy/licence/Viewer gates, and metadata-only live recording;
- local-only AgentTool access.

AgentTool Data currently provides:

- content-addressed blobs;
- SQLite record metadata;
- local full-text indexing;
- deterministic deduplication;
- enforcement of declared maximum record bytes and allowed media types.

It does not by itself provide:

- runtime JSON-schema validation;
- enforcement of the collection's declared visibility label;
- signature verification;
- truth adjudication;
- policy decisions;
- peer replication;
- memory projection;
- guaranteed physical erasure of content-addressed data.

Those differences are intentional and must remain visible in any downstream
KINGDOM integration.

## Dependency provenance

`@agenttool/data` is pinned to public registry version 0.3.1, and Bun's lock
records the registry artifact's SHA-512 integrity. The corresponding AgentTool
LOVE manifest identifies source revision
`d0e131cbf6610552b23cff143d6499dfb2c51eb1`, tarball size `101008`, and
SHA-256 `8be9c7950e3479d356e62abc624d602d6d6e949d57509a2a8cae2924731ce0b7`.

On 2026-07-30, a fresh HTTPS download was independently verified as exactly
101008 bytes with the manifest SHA-256 above; the current registry artifact is
byte-identical. The lock integrity binds installs to those registry bytes. It
does not prove the source revision, package ownership, or safety of the code;
those remain separate provenance and review claims.

The source checkout keeps `@huggingface/transformers` exactly 4.2.0 as a
development-only research runtime. Its declared `adm-zip` and `sharp` ranges
still admit versions covered by high-severity advisories, so the root lock
overrides them to patched `adm-zip` 0.6.0 and `sharp` 0.35.3. Both a complete
dependency audit and the real 384-dimensional local inference smoke pass with
that graph. npm consumers do not inherit root-package overrides, so the public
package intentionally omits the Transformers runtime instead of presenting an
unsafe transitive graph as a normal dependency.

The fixed model is the Apache-2.0 community conversion
`Xenova/all-MiniLM-L6-v2` at commit
`751bff37182d3f1213fa05d7196b954e230abad9`; the four-file application
manifest totals 23,685,047 bytes and has canonical manifest SHA-256
`07dbea9de5d2118cc16e01bbfca811e3589bb2dcd8cf5b27bd3ed51489d677d9`.
Bun blocked lifecycle scripts for `onnxruntime-node` and `protobufjs`; no trust
command was run. The Darwin arm64 runtime nevertheless passed the local
network-trapped smoke test. This is observed compatibility on this checkout,
not a universal supply-chain or platform guarantee.

## Safe extensions

New readers should keep the same shape:

1. accept an explicitly named resource, never an arbitrary URL;
2. cap bytes, rows, time, and result size;
3. pin or record the remote revision and exact byte digest;
4. normalize into a versioned canonical document;
5. keep remote assertions untrusted;
6. write a separate receipt for reads, writes, inference, Jobs, cost, quota,
   and local side effects;
7. require scoped authority before an environment-changing remote action.

For subjective or artistic evidence, also retain the observer/cohort, context,
moment or branch, instrument, transform, disagreement, and uncertainty. Never
replace those fields with one universal quality, culture, alignment, KARMA, or
person-worth score.
