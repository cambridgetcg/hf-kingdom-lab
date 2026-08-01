# DPI provenance contract

The DPI integration is a static, fail-closed provenance contract. It is not a
dataset reader. Loading the contract reads one checked-in JSON file, performs
closed-schema validation, and makes no network request.

The canonical artifact is
[`data/dpi-provenance-contract.v1.json`](../data/dpi-provenance-contract.v1.json).
[`src/dpi-provenance.ts`](https://github.com/cambridgetcg/hf-kingdom-lab/blob/main/src/dpi-provenance.ts) validates every pinned
identity, file manifest, schema field, count, endpoint, column boundary, and
reader prerequisite.

## Pinned identities

| Identity | Pinned value |
| --- | --- |
| Dataset | `common-pile/data_provenance_initiative_filtered` |
| Hub object | `683012bc2c98b5e9966e1ddf` |
| Observed `main` | `8f5afcf585e4618ff12f5b6d49cb5242faf5afbd` |
| Viewer source revision | `6e4d4d169effc075f0556a06b1c1c043f1cdf661` |
| Viewer Parquet conversion | `a6219c6ca0e28d9c5eb2b325bd1305ff5cf13fc5` |
| Config / split | `default` / `train` |

`main`, the source revision used by Dataset Viewer, and the conversion branch
are separate identities. A documentation-only `main` update must not be
silently mistaken for a new conversion, and a moving
`refs/convert/parquet` branch must not replace the immutable conversion commit.

The source export contains three gzip files totalling 1,225,618,177 bytes. The
conversion contains ten Parquet shards totalling 1,891,733,238 bytes. Every
path, byte size, and Hub LFS SHA-256 assertion is listed in the JSON contract.
The LFS hashes are publisher/Hub metadata assertions; this work did not
download and rehash the 1.23 GB source export or 1.89 GB conversion.

The manifest digests are SHA-256 over lexicographically sorted UTF-8 TSV:

```text
path<TAB>decimal-size<TAB>lowercase-lfs-sha256<LF>
```

They identify the asserted manifests, not independently verified file bytes.
The source manifest digest is
`955ed01b942dfc1e7648b23fb56bfa74956cadf2e0569ce68b60fa68d2916c94`;
the Parquet manifest digest is
`48489544cad439e5f706a18ddebd7f2ed84f70f684b952457df289e490bf5b21`.

## Viewer facts and unresolved drift

Dataset Viewer reports 3,508,390 rows, five top-level columns, 4,712,748,443
in-memory bytes, and these exact shard lengths:

```text
314270, 574897, 697640, 403886, 254262,
454422, 191601, 269669, 254150, 93593
```

The publisher card reports 3,508,518 documents. The 128-document difference
is retained as unresolved evidence. The contract does not adjust either count
or imply which one is authoritative.

The complete Viewer schema is pinned in the artifact. Its top-level fields are
`added`, `id`, `metadata`, `source`, and `text`. `metadata` contains
`dataset_id`, `language`, `license`, `license_url`, `provenance`, `response`,
and `url`. Its canonical sorted-key JSON digest is
`ac1a8ea25ff81141f51b9682df6567a7be8084d924ceb15c37f4dd56f9681913`.

The dataset card says per-document licences live in `metadata.license`, but it
also warns that licence laundering or inaccurate metadata may cause incorrect
assignments. These fields are provenance assertions, not legal advice,
permission, consent, or proof of rights.

## Access boundary

The current implementation reads only the local contract. A future metadata
refresh must remain a separate, explicit operation and default-deny every URL
except the eight exact metadata URLs in the artifact:

- fixed Hub repository identity;
- fixed conversion-ref identity;
- source tree at the immutable Viewer source revision;
- Parquet tree at the immutable conversion revision;
- Dataset Viewer `/splits`, `/parquet`, `/size`, and `/info`.

Only credential-free `GET` requests with no request body are eligible. A
refresh is capped at eight requests, 65,536 response bytes per request, 262,144
response bytes in total, and 15 seconds. Partial, malformed, or drifted results
fail closed.
Redirects and remote writes are outside that metadata boundary. `/first-rows`, `/rows`,
`/filter`, and `/search` are explicitly forbidden because they return dataset
rows. `/statistics` is not allowlisted: it is unnecessary for this contract,
omits the nested provenance fields here, and may return raw categorical labels.

The `/parquet` endpoint is useful for completeness (`pending`, `failed`, and
`partial`) and announced sizes. Its returned URLs point at the mutable
conversion ref, so they are not canonical reader inputs. Exact file SHA-256
assertions come from the immutable Hub tree metadata.

## Column boundary

Any later aggregate design is restricted to these logical projections:

```text
id
metadata.dataset_id
metadata.language
metadata.license
metadata.license_url
metadata.provenance
metadata.url
```

`text` and `metadata.response` are excluded content columns. `added` and
`source` are not required by the first census and remain unprojected. `SELECT
*` and row-level output are forbidden.

Projection pushdown can avoid the `text` and `metadata.response` data pages,
but it cannot honestly promise that no text bytes enter memory. Parquet readers
must read file footers, and footers may contain column statistics. A bounded
design inspection of all ten immutable shards read 9,798,821 serialized footer
bytes (10,454,181 range-response bytes including the initial reads), no column
data pages, and retained no statistic values. It found text min/max statistics
in the Parquet metadata. The selected columns account for 56,455,411 compressed
column bytes; the excluded text/response columns account for 1,791,329,876.
Those sizes describe the Parquet metadata, not a guaranteed network transfer
ceiling.

## Why there is no reader yet

The project pins DuckDB, but the inspected runtime has no prepared `httpfs`
extension. Letting a query implicitly install or autoload native extension code
would cross the declared effect boundary. Direct DuckDB HTTP reads also do not
provide a simple hard transport-byte limit.

Accordingly the contract fixes all three reader flags to `false`:

- `reader_implemented`;
- `reader_runtime_available`;
- `reader_execution_in_scope`.

`required_prerequisites` is a requirement mask, not a capability or status
report. Its `true` values mean each condition is mandatory; none is claimed to
be currently satisfied. A future reader must independently verify every item
before any of the three reader flags can change:

- immutable conversion-commit URLs only;
- a core `httpfs` artifact prepared and hash-pinned in an explicit setup step;
- automatic extension install/load and community extensions disabled;
- credentials and proxy environment scrubbed from the child;
- fixed SQL and the exact column projection only;
- a hard parent deadline with process-group termination;
- memory, thread, temporary-storage, stdout, and result caps;
- redirect targets allowlisted, with signed redirect URLs never logged;
- a hard cumulative network-byte cap, likely through a small allowlisting range
  proxy rather than an unenforced DuckDB setting;
- closed-schema aggregate output with no row-level values.

Even after those prerequisites, the honest guarantee is “no excluded column
data pages selected and no raw values persisted,” not “no text bytes ever
entered memory.” A stricter guarantee would require a separately produced,
verified Parquet derivative with content columns and their footer statistics
removed.

## Local use

```ts
import { loadDpiProvenanceContract } from "../src/dpi-provenance.ts";

const contract = await loadDpiProvenanceContract();
```

The loader accepts an alternate local path as a test seam. It accepts no
repository ID, URL, SQL, token, transport, or reader command.

## Primary technical references

- [Dataset Viewer REST endpoints](https://huggingface.co/docs/dataset-viewer/quick_start)
- [Dataset Viewer Parquet conversion](https://huggingface.co/docs/dataset-viewer/parquet)
- [SQL Console execution boundary](https://huggingface.co/docs/hub/main/datasets-viewer-sql-console)
- [Hub Xet/LFS hash semantics](https://huggingface.co/docs/hub/xet/overview)
- [DuckDB HTTP range reads](https://duckdb.org/docs/current/core_extensions/httpfs/https.html)
- [Securing DuckDB](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview.html)
