# Flow and vibe lenses

This layer studies how an observation changes as an artifact moves through a
pair, conversation, culture/language cohort, model perspective, repeated
observer, localized region, rubric, or time series. It does not define a
universal aesthetic score.

The checked-in catalogue is
[`data/flow-lenses.v1.json`](../data/flow-lenses.v1.json). Its validator and
exact-allowlist CLI are
[`src/flow-lenses.ts`](../src/flow-lenses.ts) and
[`src/flow-cli.ts`](../src/flow-cli.ts).

In this project:

```text
flow = ordered or branching transformation from artifact/context to observation

vibe = situated observation pattern
       + observer or cohort
       + moment / turn / branch
       + instrument and transform
       + provenance and uncertainty
```

Vibe does **not** mean essence, identity, universal preference, permission, or
worth. A score can describe one instrument in one context. It cannot silently
become a fact about a person, culture, artwork, model, or being.

No quantum mechanism is needed here. Branches, uncertainty, disagreement, and
later correction are ordinary explicit data structures; calling them quantum
would add metaphor without improving the evidence model.

## The three lanes

The catalogue keeps three epistemic lanes distinct:

| Lane | Question | Example | Does not establish |
| --- | --- | --- | --- |
| Descriptive | What response or change was observed? | A listener's valence/arousal path | What everyone ought to feel |
| Normative | Preferred by whom, in which choice context? | One participant choosing a branch | Universal quality |
| Control | What shape was requested or simulated? | Low/moderate/high creative rubric | Human taste or truth |

Human, model, and mixed origins are separate fields. Model-generated critique,
reward scores, or synthetic dialogue cannot be relabelled as human preference.
Human ratings remain situated evidence rather than ground truth about value.

## Ten lenses

| Lens | Flow shape | What is unusually useful | Current route |
| --- | --- | --- | --- |
| [PRISM](https://huggingface.co/datasets/HannahRoseKirk/prism-alignment) | Conversation branch | Stated preference → choice → continued interaction → end reflection | Sealed aggregate after privacy/licence review |
| [MERP](https://huggingface.co/datasets/amaai-lab/MERP) | Continuous time | Raw and transformed per-listener affect trajectories | Schema only; quarantine audio/profiles |
| [WritingPreferenceBench](https://huggingface.co/datasets/m-a-p/Writing-Preference-Bench) | Preference pair | Expert EN/ZH creative-writing comparisons with source models | Schema only pending licence conflict |
| [ArtELingo](https://huggingface.co/datasets/youssef101/artelingo) | Culture/language | Parallel native-language affective interpretations of the same artwork | Metadata only pending terms/art rights |
| [DiscoverLLM](https://huggingface.co/datasets/kixlab/DiscoverLLM-multiturn-preferences) | Turn sequence | `criteria_history` exposes changing intent as a tree | Reuse topology with invented fixtures |
| [PAMELA](https://huggingface.co/datasets/bethgelab/PAMELA) | Repeated observer | Within-person and between-person aesthetic variation | Metadata only pending privacy/packaging repair |
| [Rich Human Feedback](https://huggingface.co/datasets/Rapidata/text-2-image-Rich-Human-Feedback) | Localized region | Missing words and low-score image regions as negative evidence | Schema only; local invented-image prototype |
| [Creative Rubrics](https://huggingface.co/datasets/vicgalle/creative-rubrics) | Rubric grid | Reversible style control without calling one level better | Bounded sample after review |
| [MMArt](https://huggingface.co/datasets/Shuaimyself/MMArt) | Perspective synthesis | Separate narrative/formal/emotional/historical fields before synthesis | Metadata only pending byte/card conflict |
| [OASST2](https://huggingface.co/datasets/OpenAssistant/oasst2) | Conversation branch | A mature multilingual tree/rank/review calibration surface | Text-free aggregate after review |

The first nine are low-attention or unusual control artifacts. OASST2 is an
explicit calibration anchor, not advertised as an undiscovered dataset.

## Hidden gems and inconvenient facts

### A Viewer can show the wrong research object

Dataset Viewer is useful, but “Viewer works” is not a completeness proof.

- PAMELA's Viewer exposes 5,083 images. The card describes 69,904 repeated
  ratings, whose annotations and profiles are nested inside one ZIP. The ZIP
  also carries a parallel `__MACOSX` tree, and an image resource fork breaks
  row post-processing.
- MERP's Viewer exposes 54 audio rows and omits all three Parquet sidecars:
  6,176 raw trials, 3,482 filtered trials, and 196 profiles.
- MMArt's card says painting images are not redistributed. The current Viewer
  schema includes `image`, and the conversion reports about 25.4 GB. That is a
  rights-relevant card/byte contradiction, not cosmetic drift.
- PRISM's main configs work, but its advertised PII/safety metadata config
  fails because one field changes type. That file must not be presented as an
  operational privacy filter.
- OASST2's Viewer is flat messages; the repository's tree exports preserve a
  different conversation topology.

The machine-readable catalogue therefore stores Viewer status, configs,
reported rows, schema, and contradiction separately from the licence and
recommended route.

### Cleaning changes the phenomenon

MERP is the clearest example. The published filtered stage removes raters,
rescales every retained person's range to `[-1, 1]`, downsamples, and smooths.
Those steps can help a particular analysis, but they also remove between-person
amplitude comparability and suppress short transitions. “Filtered” is a new
artifact with a transform history, not the raw phenomenon with mistakes erased.

Its card labels both annotation tables 10 Hz, while the filtered array lengths
are consistent with a 0.5-second stage in the source pipeline. The exact
transform order and response lag remain unresolved. A future study must compare
raw and filtered traces side by side and name its sampling grid.

### Chosen/rejected can hide the disagreement

WritingPreferenceBench retains the final pair and scores but not raw rater
votes, reasons, or discarded candidates. Its files also undercut the
“length-matched” framing: chosen outputs are longer on average, especially in
English. The useful next study is a language/category/length audit, not training
on `chosen = universally good`.

The repository also declares Apache-2.0 in Hub metadata and ODC-By in the card
body. The catalogue fails closed at schema-only rather than guessing which
declaration controls.

### Personalization is not demographic destiny

PAMELA and PRISM can reveal within-person continuity and preference changes.
They can also invite reidentification or weak subgroup storytelling:

- PAMELA joins pseudonymous repeated ratings with exact age, gender, and
  nationality. Its 199-person, 23-nationality pool is not globally
  representative.
- PRISM joins free conversation text, timestamps, locations, religion,
  ethnicity, self-description, and use cases through stable user IDs. Its
  terms explicitly prohibit deanonymisation/triangulation.

The route therefore prohibits demographic taste inference, profile export,
raw user text in ordinary analysis, and narrow cells. “Country” is not
“culture”; collection batch, worker qualification, language, and platform can
all be confounded.

### Synthesis can erase productive contradiction

MMArt's four fields are a useful interface shape, but most are model-generated.
The unified caption is another model synthesis, not consensus among human
interpreters. KINGDOM should preserve the separate lanes and their provenance;
it should not treat fluent synthesis as increased certainty.

ArtELingo offers genuinely parallel human interpretations, but language is
still only a recruitment/context proxy. The source collection is Western-canon
heavy, annotator pools are unequal, Spanish coverage is tiny, and artwork
terms are restrictive. Differences belong to named cohorts, not monolithic
ranked cultures.

## Machine-enforced shape

Every lens pins:

```text
Hub object id + full revision SHA + last-modified time + Hub licence tag
+ observer origin + epistemic lane + observation unit
+ flow axis + stages + preserved fields + losses
+ Viewer representation + licence scope + future route + forbidden claims
```

The validator rejects:

- missing `universal-vibe-score` prohibitions;
- a model-only artifact labelled as normative human preference;
- sensitive pseudonymous data without explicit reidentification and
  demographic-inference gates;
- content sampling from a component-specific licence;
- aggregation/sampling while a Viewer representation mismatch is unresolved;
- content routes for conflicting or custom licences;
- arbitrary identities, source hosts, or malformed revisions.

The catalogue itself contains no remote rows or files.

## Local use

```bash
bun src/flow-cli.ts list
bun src/flow-cli.ts list --domain visual-art
bun src/flow-cli.ts list --role hidden-gem --json
bun src/flow-cli.ts show amaai-lab/MERP
bun src/flow-cli.ts trace amaai-lab/MERP
```

`list`, `show`, and `trace` are local-only. `drift` performs one public,
credential-free Hub metadata observation for one exact curated ID; it does not
read a dataset body. `record` first refuses identity drift, validates and bounds
every retained value, then lets the existing local AgentTool node store a newly
reconstructed narrow metadata snapshot and an effects receipt:

```bash
bun src/flow-cli.ts drift amaai-lab/MERP
bun src/flow-cli.ts record amaai-lab/MERP
```

Recording does not authorize the lens's later content route. AgentTool receives
no prompt, response, image, audio, profile, dataset participant/user identifier,
or dataset row. It does retain the public repository identity by design.

## KINGDOM integration

```text
HF public evidence
  -> pinned flow-lens catalogue
  -> exact identity / licence / representation gates
  -> situated trace (stages, preserved fields, losses)
  -> optional metadata-only AgentTool receipt
  -> future sealed or invented-fixture experiment
```

- **AgentTool** stores immutable public metadata observations and effects
  receipts. It does not make the lens true, safe, representative, or licensed.
- **YUTABASE** can preserve correspondence between artifact, observer/cohort,
  moment, transform, and correction. It should not become a raw profile or
  copyrighted-corpus dump.
- **KARMA** can consume named dimensions for a bounded decision while keeping
  them plural. It should not produce one moral, aesthetic, or person-worth
  score.
- **Whitehack** can focus attention on privacy, prompt injection, secrets,
  suspicious transforms, and rights drift. It does not certify the dataset or
  supply missing consent.
- **KINGDOM** makes the project and relationships discoverable. It does not
  deploy, authorize, publish, or canonize a remote resource.

## What to build next

1. Use invented local fixtures to implement the DiscoverLLM criteria-history
   topology and Creative Rubrics control grid.
2. Add a text-free OASST2 branch-shape census with rare-cell suppression.
3. Specify a sealed PRISM aggregate with minimum-cell thresholds before any
   body read.
4. Design a MERP raw/filtered transform ledger with explicit rate, lag, and
   phase-shift uncertainty; keep audio and profiles out.
5. Revisit PAMELA only after packaging repair and a privacy review.

This order tests the architecture without turning the most sensitive or
rights-ambiguous datasets into an ingestion target.
