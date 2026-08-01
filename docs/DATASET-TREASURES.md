# Training Archaeology Atlas

The interesting Hugging Face artifacts are often not the final giant corpus.
They are the small control surfaces and rejected traces left beside it:

- the exact order examples could have appeared;
- the pilot recipes used to choose a corpus;
- the labels used to train a quality filter;
- the rows removed as possible contamination;
- the mixture used at a stage transition;
- the disagreement erased by a scalar reward;
- the step where an agent trajectory first went wrong;
- the provenance required to explain or revoke a derivative later.

`data/dataset-treasures.v1.json` is a pinned, machine-readable atlas of 15 such
artifacts. Each entry occupies one training or research phase and records its
Hub revision, observed attention signal, licence boundary, Viewer condition,
known inconsistencies, risk notes, primary sources, and smallest honest
KINGDOM route.

This is a catalogue, not a corpus mirror and not a trust list.

## The phase map

| Phase | Artifact | Why it is unusual | Initial route |
| --- | --- | --- | --- |
| Recipe selection | [DataDecide data recipes](https://huggingface.co/datasets/allenai/DataDecide-data-recipes) | 25 controlled data recipes across 14 sizes and three seeds expose pilot decisions normally discarded | Metadata-only recipe/eval ledger |
| Contamination audit | [FineMath contamination report](https://huggingface.co/datasets/HuggingFaceTB/finemath_contamination_report) | Keeps rejected rows and overlap witnesses, not only the cleaned result | Schema-only until licence clarification |
| Agent process evaluation | [CodeTraceBench](https://huggingface.co/datasets/NJU-LINK/CodeTraceBench) | Labels wrong versus merely unuseful steps inside staged coding-agent traces | Aggregate the verified split first |
| Research safety evaluation | [TELBench](https://huggingface.co/datasets/NJU-LINK/TELBench) | Localizes the span where a research trace becomes harmful | Sealed evaluation; gold never enters retrieval |
| Provenance audit | [Common Pile DPI filtered](https://huggingface.co/datasets/common-pile/data_provenance_initiative_filtered) | Preserves per-record source and licence metadata | Aggregate provenance, omit text |
| Midtraining annealing | [Dolmino 10B mix](https://huggingface.co/datasets/allenai/dolma3_dolmino_mix-10B-1025) | Shows the 10B stage-two micro-anneal mixture behind OLMo 3 | Metadata and per-config schema map |
| Data order | [Pile preshuffled seeds](https://huggingface.co/datasets/EleutherAI/pile-preshuffled-seeds) | Retains GPT-NeoX index maps for ten exact shuffle seeds | Index manifest only |
| Mixture search | [RegMix data](https://huggingface.co/datasets/sail/regmix-data) | Makes domain mixture choice a regression experiment over 512 proxy models | Recipe graph; no one-terabyte mirror |
| Quality-label generation | [FineWeb-Edu Llama 3 annotations](https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu-llama3-annotations) | Exposes the teacher prompt and scores behind the famous filtered corpus | Aggregate calibration first |
| Synthetic planning | [Cosmopedia metadata](https://huggingface.co/datasets/HuggingFaceTB/cosmopedia-meta) | 31M rows describe seed, audience, format, and length without the generated text | Schema-only until sidecar licence exists |
| Multidimensional quality | [QuRating judgments](https://huggingface.co/datasets/princeton-nlp/QuRating-GPT3.5-Judgments) | Keeps four quality axes and vote structure instead of one goodness score | Synthetic schema only; licence missing |
| RL data filtering | [INTELLECT-2 RL dataset](https://huggingface.co/datasets/PrimeIntellect/INTELLECT-2-RL-Dataset) | Exposes task type, verification information, and a reference-model difficulty signal | Task/solve-rate aggregate first |
| Data attribution | [FTRACE](https://huggingface.co/datasets/DataAttributionEval/ftrace) | Pairs train/reference facts across three model configurations for attribution evaluation | Synthetic contract; licence missing |
| Memory continuity | [MemoryAgentBench](https://huggingface.co/datasets/ai-hyz/MemoryAgentBench) | Separates retrieval, test-time learning, global understanding, and conflict updates | Held-out, gold-sealed evaluation |
| Unlearning | [TOFU](https://huggingface.co/datasets/locuslab/TOFU) | Provides fictitious people and separate forget/retain/holdout controls | Layer-by-layer revocation evaluation |

The first thirteen are low-attention or overlooked side artifacts relative to
their information value. MemoryAgentBench and TOFU are marked as calibration
anchors rather than pretending they are undiscovered.

## What the archaeology found

### 1. The highest knowledge-per-byte artifacts describe decisions

DataDecide is approximately 19 TB, but KINGDOM does not initially need its
token shards. The valuable object is the graph connecting recipe, filtering,
deduplication, scale, seed, checkpoint, and evaluation. The paper reports that
a simple 150M-model ranking was already a strong predictor of ranking at 1B,
while its controlled suite makes the limits of that claim inspectable.
[DataDecide paper](https://arxiv.org/abs/2504.11393)

RegMix preserves another decision surface: 512 tiny proxy runs used to predict
a domain mixture before larger training. Its paper also reports domain
interactions that contradicted simple intuitions, which is a good reason to
retain alternative recipes and uncertainty rather than crown one permanent
mixture. [RegMix paper](https://arxiv.org/abs/2407.01492)

There is no useful quantum layer hiding here. The practical adaptation loop is
revision-aware and phase-aware:

```text
question -> permitted evidence pool -> candidate recipe
         -> small controlled run -> evaluation with uncertainty
         -> retained alternatives -> explicit promotion decision
```

Calling this “quantum” would add branding, not explanatory power.

### 2. Negative evidence is a first-class dataset

FineMath's contamination report is more useful for an evidence system than a
bare “decontaminated” badge. Its schema keeps the source page, matching
benchmark, n-gram, diff, longest overlap, and ratios. That supports exclusion
witnesses and regression tests. It does **not** prove that every match is real
benchmark leakage, and no Hub licence is currently declared.

CodeTraceBench makes a similar move for agent behavior. A final task result
cannot say whether the agent changed state incorrectly, explored redundantly,
or failed much earlier. Its verified split retains stage and step labels across
1,000 traces. [CodeTracer paper](https://arxiv.org/abs/2604.11641)

TELBench moves the idea into deep research: it distinguishes failed searches
and harmless exploration from spans whose unsupported or conflicting claims
actually damage the result. Its encrypted artifact should remain a sealed
evaluation plane. [TELBench paper](https://arxiv.org/abs/2606.02060)

### 3. Dataset Viewer is an observation surface, not corpus truth

The pass found several live mismatches worth preserving instead of smoothing
over:

- RegMix's card says 34 JSONL files; the current tree has 977 JSONL payloads
  and 979 repository entries total.
- Dolmino has a default first-row preview, but its full default size/Parquet
  conversion fails because component schemas differ.
- The filtered DPI card and Viewer differ by 128 rows.
- Large Viewer conversions can be partial or estimated even when the API says
  the Viewer is valid.
- A repository licence tag can describe a wrapper without replacing the terms
  of every upstream component.

The atlas therefore stores `viewer.status`, `known_drift`, and licence scope
separately. `ready` means a current HF tabular surface exists. It does not mean
the data is complete, correct, safe, private-data-free, or licensed for every
purpose.

### 4. Provenance must survive every transformation

The Common Pile DPI slice is valuable precisely because there is no blanket
licence. Each record carries its source dataset, licence list, licence URL, and
source URL. The Common Pile work explicitly focuses on public-domain and openly
licensed sources, while still warning about metadata error and licence
laundering. [Common Pile paper](https://arxiv.org/abs/2506.05209),
[Data Provenance Initiative paper](https://arxiv.org/abs/2310.16787)

Every later KINGDOM derivative should retain at least:

```text
upstream repo id + opaque Hub object id + full revision SHA + source file digest
+ transform name/version + component licence/provenance
+ training/eval phase + human/model/heuristic label origin
```

A single `open: true` field is not an acceptable replacement.

### 5. Quality is plural, contextual evidence

FineWeb-Edu's annotations reveal a one-teacher classifier stage. QuRating keeps
votes across educational value, facts/trivia, required expertise, and writing
style. Together they suggest a useful KINGDOM shape:

```text
subject -> lens -> rater -> observation -> rationale/evidence
        -> uncertainty/disagreement -> bounded decision context
```

This can inform a KARMA-facing interface without turning KARMA into one score.
A dimension can help a particular decision while remaining neither universal
truth nor a measure of a being's worth.

### 6. Continuity and deletion are different systems questions

MemoryAgentBench tests four capabilities through incremental interactions,
including conflict updates rather than pure lookup.
[MemoryAgentBench paper](https://arxiv.org/abs/2507.05257)

TOFU uses fictitious authors to test behavioral unlearning. Its result cannot
prove that raw rows, content-addressed blobs, SQLite indexes, embeddings,
caches, backups, peer copies, or derived summaries were erased. KINGDOM should
measure those layers separately:

```text
source row -> immutable evidence -> search index -> vector
           -> memory projection -> summary/cache -> model behavior
```

Revocation can make one layer unavailable while copies remain elsewhere. The
receipt must say exactly which layer changed and which did not.

## Local commands

The companion CLI is deliberately separate from the existing `hfkl` command,
so the atlas can be reviewed and cherry-picked without colliding with current
lab work.

```bash
# Local catalogue read; no network or writes
bun src/treasure-cli.ts list
bun src/treasure-cli.ts list --phase agent-process-evaluation --json
bun src/treasure-cli.ts show NJU-LINK/CodeTraceBench

# One exact public metadata read; no dataset body or write
bun src/treasure-cli.ts drift NJU-LINK/CodeTraceBench

# Same pinned metadata check, then an existing local AgentTool resource
# observation and run receipt. Fails closed if SHA/licence/access drifted.
bun src/treasure-cli.ts record NJU-LINK/CodeTraceBench
```

`record` stores the normalized current Hub metadata in the existing
`hf-resources-v1` collection and an effect receipt in `hf-run-receipts-v1`.
The richer treasure analysis stays in the versioned JSON catalogue. It does
not download a row, repository file, model, archive, or encrypted benchmark.

## KINGDOM component roles

```text
HF public metadata
  -> pinned treasure card + drift check
     -> licence/provenance quarantine
        -> phase-specific, inert adapter
           -> derived evidence card or sealed eval

AgentTool: immutable observations, source identities, effects receipts
Whitehack: attention over authorized inert text/code; never executes traces
YUTABASE: derived provenance/evaluation cards; not a raw-corpus dumping ground
KINGDOM: discovery, relationship map, and explicit promotion boundary
```

What each component does **not** do matters:

- An AgentTool receipt proves what the adapter recorded, not that a publisher
  assertion is true or a licence interpretation is legally correct.
- Whitehack can focus attention on secrets, prompt injection, unsafe code, and
  suspicious changes. It does not certify safety or supply benchmark labels.
- YUTABASE can preserve correspondence and revision history. It should not mix
  benchmark gold into the retrieval context of the system being evaluated.
- A KINGDOM card makes a project discoverable. It does not deploy, download,
  authorize, or canonize the remote artifact.

## Recommended build order

1. **DataDecide recipe ledger — implemented.** The
   [bounded five-stage ledger](DATADECIDE-LEDGER.md) preserves exact aliases,
   scale/seed roles, branch target SHAs, evaluation joins, and known drift
   without token shards, weights, or instance bodies.
2. **DPI provenance census — contract implemented, reader deferred.** The
   [static provenance contract](DPI-PROVENANCE.md) pins source/conversion
   manifests, schema, columns, and the 128-row discrepancy. A live aggregate
   reader remains out of scope until its pinned `httpfs`, subprocess, redirect,
   and hard network-byte-cap prerequisites are actually satisfied.
3. **FineMath exclusion-witness contract.** Use invented local fixtures until
   the missing dataset licence is clarified.
4. **CodeTraceBench verified census.** Aggregate stage/error distributions;
   only then design a tiny inert adapter with secret and injection checks.
5. **TELBench claim-evidence deck.** Decrypt only in a hermetic, explicitly
   authorized experiment; seal gold labels and prohibit URL refetch.
6. **Memory + revocation matrix.** Run MemoryAgentBench and TOFU as held-out
   tests across YUTABASE, AgentTool projections, vectors, caches, and summaries.

This order grows understanding before storage volume. Each step produces a
reviewable artifact even if the following step is deferred.

## Leads deliberately kept outside the active atlas

- `microsoft/AgentRx` is valuable but auto-gated; viewing its public card does
  not grant file access or accept its terms.
- `zai-org/AgentInstruct`, `openai/webgpt_comparisons`, and several useful
  reasoning sidecars currently lack a clear Hub dataset licence.
- `WenyiWU0111/CoMEM-agent-memory-trajectories` has a Viewer schema failure and
  archive-heavy payload; it stays quarantined.
- WebLINX is excellent for conversational browser traces but its
  CC-BY-NC-SA-4.0 boundary is not seamless for a generally reusable ecosystem.
- HelpSteer2 and raw UltraFeedback remain useful alignment anchors, but their
  visibility is much higher than the side artifacts prioritized here.
- DTap trajectories are already represented by the lab's bounded tree census,
  so the atlas does not duplicate that existing route.

Absence from the active atlas is not a judgment on research quality. It means
the current integration boundary is gated, unclear, duplicative, or less
informative per unit of risk and work.
