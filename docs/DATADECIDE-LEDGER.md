# DataDecide Phase Ledger

`data/datadecide-ledger.v1.json` is a small, static reconstruction of the
DataDecide experiment path:

```text
recipe -> scale -> seed -> checkpoint -> evaluation
```

It keeps the identifiers needed to join those phases without copying the
approximately 19 TB recipe payload, model weights, or evaluation-instance
archives. `src/datadecide.ts` validates the checked-in evidence locally and
does not make a network request.

This is an evidence ledger, not a claim that a recipe is universally good, a
licence interpretation is legally authoritative, or a branch still points to
the same commit on the live Hub.

## Exact pinned constellation

The collection identity is
`allenai/datadecide-67edb1d2bacba40b5d3ed633`: 354 items consisting of three
datasets, 350 models, and paper `2504.11393`. The current official PPL sidecar
is useful but is not in that collection.

| Artifact | Pinned revision | Publisher licence evidence | In collection | Local route |
| --- | --- | --- | --- | --- |
| `allenai/DataDecide` source | `68abc496587935b7211e9894206e78f15d535832` | Apache-2.0 repository licence | No | Pinned small files |
| OLMo `named_data_mixes.py` | commit `7094aab0448096f4994cae881edbd629d6c2f3de`, blob `3db799996c952a14b32efb9ff67488f7100f1b2a` | Apache-2.0 repository licence | No | Pinned small file |
| `allenai/DataDecide-data-recipes` | `3baf34baf5b636f0943401b5c6a2ccb7e5cf3bb9` | ODC-By-1.0 Hub metadata | Yes | Metadata only; no token shards |
| `allenai/DataDecide-eval-results` | `9919b5a0e61e57a85021263918fa82d6ceaee038` | ODC-By-1.0 Hub metadata | Yes | Bounded aggregates |
| `allenai/DataDecide-eval-instances` | `23f3b2e186ca6c39026e3efa00e4af397680c075` | ODC-By-1.0 Hub metadata | Yes | Schema only in this ledger |
| `allenai/DataDecide-ppl-results` | `c4a9fa360a0c8351e71f3ede04dd165995fab68c` | No dataset licence declared in Hub metadata | **No** | Metadata only |

The validator fixes all of those identities. A future refresh should be an
explicit evidence update, not an automatic move to whatever `main` means at
runtime.

## Five tables and cumulative path keys

The normalized tables have their own primary keys and a cumulative path key
showing what must be known at each phase.

| Stage/table | Primary key | Cumulative path key | Checked-in coverage |
| --- | --- | --- | --- |
| `recipes` | `recipe_id` | `recipe_id` | All 25 alias records |
| `scales` | `scale_id` | `recipe_id, scale_id` | All 14 scale contracts |
| `seeds` | `seed_id` | `recipe_id, scale_id, seed_id` | All five operational seed identities and scientific scopes |
| `checkpoints` | `checkpoint_id` | `recipe_id, scale_id, seed_id, step` | Five immutable branch/SHA witnesses; the full manifest remains upstream |
| `evaluations` | `evaluation_id` | `recipe_id, scale_id, seed_id, step, task_id, protocol_id` | Two aggregate join witnesses |

The checkpoint table records the full static manifest boundary separately:
`checkpoints/weka_paths.jsonl` has 1,103 raw run rows. Three explicitly legacy
DCLM 1B rows are excluded, leaving 1,100 usable run rows and 31,404 checkpoint
revisions. The ledger does not pretend its five witnesses are the full table.

## Aliases are required data

There is no safe universal recipe string. Each recipe keeps three namespaces:

- `internal_slug`: code and Weka manifest identity;
- `public_slug`: model repository identity;
- `evaluation_name`: evaluation table identity.

For example:

```text
internal  dolma17-75p-DCLM-baseline-25p
public    dclm-baseline-25p-dolma1.7-75p
eval      DCLM 25% / Dolma 75%
```

The percentage order changes between the internal and public names. Joins
therefore require an explicit alias namespace and exact, case-sensitive match.
The validator rejects a missing or substituted alias, and model repo names are
derived only from `public_slug`.

## Three scientific seeds, five operational seed identities

The paper's scientific design is exactly `25 recipes x 14 scales x 3 seeds =
1,050 model runs`.

- Seed `6198` (`default`) is the default run at every scale.
- At the 13 non-target scales, numeric seeds `14` and `15` are `small aux 2`
  and `small aux 3`. Their cap is the lesser of the full scale schedule and
  25% of the **1B target compute budget**. It is not 25% of each small model's
  own schedule, so a sufficiently small run can still finish normally.
- At 1B, the three scientific full runs are seeds `6198`, `4`, and `5`; the
  latter two are `large aux 2` and `large aux 3`.
- The operational release also carries partial seed-14 and seed-15 branches at
  1B. That makes five seed identities visible on 1B model repos and reconciles
  the 1,100-row operational manifest without rewriting the 1,050-run
  scientific design.

Seed numbers, evaluation aliases with spaces, and branch aliases with hyphens
are stored separately.

## A checkpoint is branch name plus target commit

Hub branches are useful coordinate names but are mutable pointers. Every
checkpoint witness therefore requires both:

```text
revision.kind = branch
revision.name = step{step}-seed-{branch_alias}
revision.target_commit_sha = 40-character commit SHA
```

For example, `allenai/DataDecide-c4-4M` branch
`step5725-seed-default` is pinned to
`ca03048362e0fbc9c2d22e0ca1de5433e30570bd` in this observation. A bare
`main` or branch name without target SHA fails local validation. If a later
live refresh observes a retargeted branch, its changed target SHA must first be
written into a reviewed ledger revision; the static loader does not poll Hub
branches or detect retargeting by itself. The ledger also verifies tokens as
`step x batch x 2048` and compute as decimal-string `6ND` so large integer FLOP
counts are not rounded by JSON.

## Evaluation and licence boundary

The primary evaluation dataset contains 1,410,750 aggregate rows. Its
`metrics` column is a Python-literal-style string with single quotes, not JSON.
This ledger stores two already-selected numeric witnesses and records the
encoding. An adapter may retain the raw string or use a constrained literal
parser; it must never execute the value with `eval`.

An evaluation row may reference only a pinned artifact whose publisher licence
metadata is declared and whose curated route permits content. This blocks the
PPL sidecar even if someone swaps its artifact id into an otherwise valid
evaluation row. The PPL schema remains valuable remote metadata, but its rows
stay out until the publisher clarifies terms. Conversely, a declared licence
does not force a body read: the recipe token-shard dataset remains
metadata-only by design.

Dataset-level metadata also does not replace the rights and provenance of
embedded benchmark questions, upstream corpus components, or downstream
derivatives.

## The 2024 / 2048 paper drift

The arXiv v2 hyperparameter table prints sequence length `2024`. The pinned
code sets `SEQUENCE_LENGTH = 2048`. Released 1B arithmetic independently gives
the code value:

```text
69,369 steps x 704 sequences x 2,048 tokens = 100,015,669,248 tokens
```

The ledger uses 2048 for joins and arithmetic while retaining 2024 as
`documented-drift`. It does not silently edit the paper or claim the
contradiction never existed.

## Local use

```ts
import {
  findDataDecideCheckpoint,
  loadDataDecideLedger,
  resolveDataDecideRecipe,
} from "../src/datadecide.ts";

const ledger = await loadDataDecideLedger(); // local JSON read only

const recipe = resolveDataDecideRecipe(
  ledger,
  "evaluation_name",
  "C4",
);

const checkpoint = findDataDecideCheckpoint(ledger, {
  recipe: { namespace: "public_slug", value: recipe.aliases.public_slug },
  scale_label: "4M",
  numeric_seed: 6198,
  step: 5725,
});
```

The lookup searches only the bounded witnesses. Failure does not mean an
upstream checkpoint does not exist; it means that checkpoint was not included
in this intentionally small local evidence set.

## Sources

- [DataDecide collection](https://huggingface.co/collections/allenai/datadecide-67edb1d2bacba40b5d3ed633)
- [DataDecide paper v2](https://arxiv.org/abs/2504.11393v2)
- [Pinned DataDecide source](https://github.com/allenai/DataDecide/tree/68abc496587935b7211e9894206e78f15d535832)
- [Pinned OLMo recipe manifest](https://github.com/allenai/OLMo/blob/7094aab0448096f4994cae881edbd629d6c2f3de/olmo/data/named_data_mixes.py)
- [Data recipes](https://huggingface.co/datasets/allenai/DataDecide-data-recipes)
- [Evaluation results](https://huggingface.co/datasets/allenai/DataDecide-eval-results)
- [Evaluation instances](https://huggingface.co/datasets/allenai/DataDecide-eval-instances)
- [PPL results sidecar](https://huggingface.co/datasets/allenai/DataDecide-ppl-results)
