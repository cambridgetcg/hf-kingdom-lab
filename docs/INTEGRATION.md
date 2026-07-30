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

The local node declares three collections:

| Collection | Canonical content |
| --- | --- |
| `hf-resources-v1` | `hf-kingdom-resource/v1` |
| `hf-run-receipts-v1` | `hf-kingdom-run-receipt/v1` |
| `hf-dataset-aggregates-v1` | `hf-kingdom-dataset-aggregate/v1` |

Resource records hold normalized Hub metadata and the observation boundary.
Run receipts independently hold requested resources, effects, local record
IDs, content hashes, and limitations. Aggregate records hold source bytes,
digest, fixed SQL, aggregate rows, tool versions, effects, and limitations.

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

`@agenttool/data` is pinned to the public 0.3.1 tarball URL. The corresponding
AgentTool LOVE manifest identifies source revision
`d0e131cbf6610552b23cff143d6499dfb2c51eb1`, tarball size `101008`, and
SHA-256 `8be9c7950e3479d356e62abc624d602d6d6e949d57509a2a8cae2924731ce0b7`.

Bun's URL lock entry does not carry that integrity digest. A separate
point-in-time tarball verification can establish that the downloaded public
artifact matched the manifest during verification, but it does not make every
future install cryptographically bound to that digest. Vendoring a
digest-pinned artifact or adding a preinstall verifier would be needed for
that stronger property. On 2026-07-30, a fresh HTTPS download was verified as
exactly 101008 bytes with the manifest SHA-256 above; the temporary verifier
copy was then removed.

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
