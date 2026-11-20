import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EMBEDDING_ASSETS, EMBEDDING_REPO, EMBEDDING_REVISION } from "../src/embedding.ts";
import {
  CLASS_KEY,
  assertModelRightsRegister,
  loadModelRightsRegister,
  type ModelRightsRegister,
} from "../src/model-rights.ts";

const ROOT = resolve(import.meta.dir, "..");
const SHA40 = /^[0-9a-f]{40}$/;
const ESTATE_SOURCE = {
  repository: "cambridgetcg/hf-kingdom-lab",
  path: "src/embedding.ts",
  commit: "d8e48068bd9af7689f3fea6cbb8d05d4e10e312a",
  locator: "EMBEDDING_ASSETS",
};

// Mutations reach into the parsed JSON freely; the validator is what types it.
type Draft = Record<string, any>;

function rowFor(register: ModelRightsRegister, repoId: string) {
  const row = register.entries.find((entry) => entry.repo_id === repoId);
  if (!row) throw new Error(`test register has no row for ${repoId}`);
  return row;
}

describe("model rights register", () => {
  test("pins every row to a commit, leaves it unreviewed and never clears a reseed", async () => {
    const register = await loadModelRightsRegister();
    expect(register.protocol).toBe("hf-kingdom-model-rights/v1");
    expect(register.entries.map((entry) => entry.repo_id)).toEqual([
      "Xenova/all-MiniLM-L6-v2",
      "HuggingFaceTB/SmolLM2-135M-Instruct",
      "Yu-and-Ai/xenia-revocable-feedback-smollm2-135m",
    ]);
    for (const entry of register.entries) {
      expect(entry.revision).toMatch(SHA40);
      expect(entry.reseed).toBe("not-cleared");
      expect(entry.class).toBe("unreviewed");
      expect(entry.reviewer).toBeNull();
      expect(entry.reviewed_on).toBeNull();
      expect(entry.duties).toEqual([]);
      expect(entry.drift).toEqual([]);
      expect(entry.upstream_url).toBe(
        `https://huggingface.co/${entry.repo_id}/tree/${entry.revision}`,
      );
      expect(entry.pin_sources.length).toBeGreaterThan(0);
    }
    expect(register.boundary).toEqual(expect.objectContaining({
      classes_are_working_reading_not_legal_advice: true,
      points_at_upstream_commit_pinned_urls: true,
      weights_published_or_seeded_by_this_register: false,
      reseed_cleared_for_any_row: false,
      network_requests_made_to_build: false,
      model_files_read_or_hashed_to_build: false,
    }));
    expect(register.classes).toEqual(CLASS_KEY);
    expect(register.formats.weights).toEqual(["safetensors", "gguf", "onnx"]);
    expect(register.formats.never).toEqual(["pickle"]);
  });

  test("records the all-MiniLM row as ONNX, copied from the lab's fixed manifest", async () => {
    const register = await loadModelRightsRegister();
    const row = rowFor(register, EMBEDDING_REPO);
    expect(row.revision).toBe(EMBEDDING_REVISION);
    if (row.files === "pending") throw new Error("all-MiniLM files must be recorded");
    const onnx = row.files.filter((file) => file.format === "onnx");
    expect(onnx.map((file) => file.path)).toEqual(["onnx/model_quantized.onnx"]);
    expect(onnx[0]!.external_data_check).toBe("pending");
    expect(row.files.every((file) => file.external_data_evidence === null)).toBe(true);
    expect(row.files.map((file) => ({
      path: file.path,
      bytes: file.size,
      sha256: file.sha256,
      canonical_url: file.upstream_url,
    }))).toEqual(EMBEDDING_ASSETS.map((asset) => ({ ...asset })));
    expect(row.files.every((file) => file.source.path === "src/embedding.ts")).toBe(true);
    expect(row.license.tag_at_pin).toBe("apache-2.0");
  });

  test("keeps rows without a public file digest or licence record as pending", async () => {
    const register = await loadModelRightsRegister();
    for (const repoId of [
      "HuggingFaceTB/SmolLM2-135M-Instruct",
      "Yu-and-Ai/xenia-revocable-feedback-smollm2-135m",
    ]) {
      const row = rowFor(register, repoId);
      expect(row.files).toBe("pending");
      expect(row.license).toEqual({ tag_at_pin: "not recorded", observed_on: null, source: null });
      expect(row.hub_flags).toEqual({
        gated: null,
        private: null,
        disabled: null,
        observed_on: null,
        source: null,
      });
    }
    expect(rowFor(register, "Yu-and-Ai/xenia-revocable-feedback-smollm2-135m").origin)
      .toBe("estate");
  });

  test("accepts a reviewed row with a named reviewer, a date and duties", async () => {
    const register = await loadModelRightsRegister();
    const reviewed = structuredClone(register) as Draft;
    Object.assign(reviewed.entries[0], {
      class: "T",
      reviewer: "A named reviewer",
      reviewed_on: "2026-11-20",
      duties: ["Keep the licence text and notices with every copy."],
    });
    reviewed.entries[0].drift.push({
      observed_on: "2026-11-21",
      observation: "Head moved past the pin; the pinned revision still resolves.",
      source: ESTATE_SOURCE,
    });
    Object.assign(reviewed.entries[0].files[3], {
      external_data_check: "no-external-data",
      external_data_evidence: { checked_on: "2026-11-20", source: ESTATE_SOURCE },
    });
    expect(() => assertModelRightsRegister(reviewed)).not.toThrow();
  });

  test("accepts class N on a row whose licence and flags are not recorded", async () => {
    const register = await loadModelRightsRegister();
    const reviewed = structuredClone(register) as Draft;
    Object.assign(reviewed.entries[1], {
      class: "N",
      reviewer: "A named reviewer",
      reviewed_on: "2026-11-20",
    });
    expect(() => assertModelRightsRegister(reviewed)).not.toThrow();
  });

  test("rejects a mutated copy for every rule", async () => {
    const register = await loadModelRightsRegister();
    const cases: Array<{ name: string; mutate: (draft: Draft) => void; message: string }> = [
      {
        name: "short revision",
        mutate: (d) => { d.entries[1].revision = "12fd25f7"; },
        message: "revision must be a 40-character lowercase hex commit",
      },
      {
        name: "branch name as revision",
        mutate: (d) => { d.entries[0].revision = "main"; },
        message: "revision must be a 40-character lowercase hex commit",
      },
      {
        name: "uppercase revision",
        mutate: (d) => { d.entries[2].revision = d.entries[2].revision.toUpperCase(); },
        message: "revision must be a 40-character lowercase hex commit",
      },
      {
        name: "cleared reseed",
        mutate: (d) => { d.entries[0].reseed = "cleared"; },
        message: "reseed must be not-cleared",
      },
      {
        name: "class without a reviewer",
        mutate: (d) => { d.entries[0].class = "P"; d.entries[0].reviewed_on = "2026-11-20"; },
        message: "class P requires a named reviewer",
      },
      {
        name: "class with an empty reviewer",
        mutate: (d) => {
          Object.assign(d.entries[0], { class: "P", reviewer: "  ", reviewed_on: "2026-11-20" });
        },
        message: "entries[0].reviewer must be a bounded non-empty string",
      },
      {
        name: "class without a date",
        mutate: (d) => { d.entries[0].class = "T"; d.entries[0].reviewer = "A named reviewer"; },
        message: "class T requires a reviewed_on date",
      },
      {
        name: "class with an impossible date",
        mutate: (d) => {
          Object.assign(d.entries[0], {
            class: "N",
            reviewer: "A named reviewer",
            reviewed_on: "2026-02-30",
          });
        },
        message: "reviewed_on must be a calendar date",
      },
      {
        name: "unknown class",
        mutate: (d) => { d.entries[0].class = "open"; },
        message: "class must be one of: unreviewed, P, T, N",
      },
      {
        name: "unreviewed row with a reviewer",
        mutate: (d) => { d.entries[0].reviewer = "A named reviewer"; },
        message: "is unreviewed, so reviewer and reviewed_on must be null",
      },
      {
        name: "unreviewed row with duties",
        mutate: (d) => { d.entries[0].duties = ["Keep the notices."]; },
        message: "is unreviewed, so duties must stay empty",
      },
      {
        name: "gated row classed as perpetual",
        mutate: (d) => {
          Object.assign(d.entries[0], {
            class: "P",
            reviewer: "A named reviewer",
            reviewed_on: "2026-11-20",
          });
          d.entries[0].hub_flags.gated = "manual";
        },
        message: "is gated, private or disabled, so its class must be N",
      },
      {
        name: "perpetual class on a row where nothing is recorded",
        mutate: (d) => {
          Object.assign(d.entries[1], {
            class: "P",
            reviewer: "A named reviewer",
            reviewed_on: "2026-11-20",
          });
        },
        message: "entries[1].class P requires a recorded licence tag at the pin",
      },
      {
        name: "conditional class with flags recorded but no licence tag",
        mutate: (d) => {
          Object.assign(d.entries[0], {
            class: "T",
            reviewer: "A named reviewer",
            reviewed_on: "2026-11-20",
          });
          d.entries[0].license = { tag_at_pin: "not recorded", observed_on: null, source: null };
        },
        message: "entries[0].class T requires a recorded licence tag at the pin",
      },
      {
        name: "conditional class with a licence tag but unknown gating",
        mutate: (d) => {
          Object.assign(d.entries[0], {
            class: "T",
            reviewer: "A named reviewer",
            reviewed_on: "2026-11-20",
          });
          d.entries[0].hub_flags.gated = null;
        },
        message: "entries[0].class T requires recorded Hub flags showing the repository is not gated",
      },
      {
        name: "perpetual class with every Hub flag unknown",
        mutate: (d) => {
          Object.assign(d.entries[0], {
            class: "P",
            reviewer: "A named reviewer",
            reviewed_on: "2026-11-20",
          });
          d.entries[0].hub_flags = {
            gated: null,
            private: null,
            disabled: null,
            observed_on: null,
            source: null,
          };
        },
        message: "entries[0].class P requires recorded Hub flags showing the repository is not gated",
      },
      {
        name: "empty file list",
        mutate: (d) => { d.entries[0].files = []; },
        message: "files must be an array of 1-64 items",
      },
      {
        name: "files neither pending nor a list",
        mutate: (d) => { d.entries[1].files = "unknown"; },
        message: 'files must be "pending" or a non-empty file list',
      },
      {
        name: "file without a size",
        mutate: (d) => { delete d.entries[0].files[0].size; },
        message: "files[0] must contain exactly",
      },
      {
        name: "file with a zero size",
        mutate: (d) => { d.entries[0].files[0].size = 0; },
        message: "size must be a positive integer byte count",
      },
      {
        name: "file with a short sha256",
        mutate: (d) => { d.entries[0].files[3].sha256 = "afdb6f1a"; },
        message: "sha256 must be 64 lowercase hex characters",
      },
      {
        name: "file with a git blob id instead of a sha256",
        mutate: (d) => { d.entries[0].files[1].sha256 = "0".repeat(40); },
        message: "sha256 must be 64 lowercase hex characters",
      },
      {
        name: "pickle format",
        mutate: (d) => { d.entries[0].files[3].format = "pickle"; },
        message: "pickle format, which is never allowed",
      },
      {
        name: "PyTorch checkpoint format",
        mutate: (d) => { d.entries[0].files[3].format = "pt"; },
        message: "pickle format, which is never allowed",
      },
      {
        name: "pickle-based path under an allowed format",
        mutate: (d) => {
          const file = d.entries[0].files[3];
          file.path = "pytorch_model.bin";
          file.format = "safetensors";
          file.external_data_check = "not-applicable";
        },
        message: "names a pickle-based file, which is never allowed",
      },
      {
        name: "format outside the allowed list",
        mutate: (d) => { d.entries[0].files[3].format = "tflite"; },
        message: "format must be one of: safetensors, gguf, onnx, json",
      },
      {
        name: "path that does not match its format",
        mutate: (d) => { d.entries[0].files[0].format = "safetensors"; },
        message: "does not match its safetensors format",
      },
      {
        name: "ONNX file without an external data check",
        mutate: (d) => { d.entries[0].files[3].external_data_check = "not-applicable"; },
        message: "is ONNX, so its external data check must be pending or recorded",
      },
      {
        name: "external data check on a non-ONNX file",
        mutate: (d) => { d.entries[0].files[0].external_data_check = "pending"; },
        message: "external_data_check applies only to ONNX files",
      },
      {
        name: "ONNX check marked done without evidence",
        mutate: (d) => { d.entries[0].files[3].external_data_check = "no-external-data"; },
        message: "files[3].external_data_evidence must record the date and source",
      },
      {
        name: "ONNX check marked done with evidence that has no source",
        mutate: (d) => {
          Object.assign(d.entries[0].files[3], {
            external_data_check: "no-external-data",
            external_data_evidence: { checked_on: "2026-11-20" },
          });
        },
        message: "files[3].external_data_evidence must contain exactly: checked_on, source",
      },
      {
        name: "ONNX check marked done with an impossible date",
        mutate: (d) => {
          Object.assign(d.entries[0].files[3], {
            external_data_check: "no-external-data",
            external_data_evidence: { checked_on: "2026-13-01", source: ESTATE_SOURCE },
          });
        },
        message: "external_data_evidence.checked_on must be a calendar date",
      },
      {
        name: "external data evidence on a pending check",
        mutate: (d) => {
          d.entries[0].files[3].external_data_evidence = {
            checked_on: "2026-11-20",
            source: ESTATE_SOURCE,
          };
        },
        message: "files[3].external_data_evidence must be null until a no-external-data check",
      },
      {
        name: "external data evidence on a non-ONNX file",
        mutate: (d) => {
          d.entries[0].files[0].external_data_evidence = {
            checked_on: "2026-11-20",
            source: ESTATE_SOURCE,
          };
        },
        message: "files[0].external_data_evidence must be null until a no-external-data check",
      },
      {
        name: "file without the external data evidence field",
        mutate: (d) => { delete d.entries[0].files[0].external_data_evidence; },
        message: "files[0] must contain exactly",
      },
      {
        name: "file URL that follows a branch",
        mutate: (d) => {
          d.entries[0].files[0].upstream_url =
            "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json";
        },
        message: "upstream_url must be the commit-pinned resolve URL",
      },
      {
        name: "row URL that follows a branch",
        mutate: (d) => {
          d.entries[1].upstream_url =
            "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/tree/main";
        },
        message: "upstream_url must be the commit-pinned tree URL",
      },
      {
        name: "repeated file path",
        mutate: (d) => { d.entries[0].files[1] = structuredClone(d.entries[0].files[0]); },
        message: "must not repeat a path: config.json",
      },
      {
        name: "drift that is not a list",
        mutate: (d) => { d.entries[0].drift = {}; },
        message: "drift must be a bounded array",
      },
      {
        name: "drift that goes back in time",
        mutate: (d) => {
          d.entries[0].drift = [
            { observed_on: "2026-12-02", observation: "Later.", source: ESTATE_SOURCE },
            { observed_on: "2026-12-01", observation: "Earlier.", source: ESTATE_SOURCE },
          ];
        },
        message: "drift is append-only, so its dates must not go backwards",
      },
      {
        name: "licence tag without its source",
        mutate: (d) => { d.entries[0].license.source = null; },
        message: "license.source must be an object",
      },
      {
        name: "unrecorded licence that claims an observation date",
        mutate: (d) => { d.entries[1].license.observed_on = "2026-11-14"; },
        message: "is not recorded, so observed_on and source must be null",
      },
      {
        name: "licence tag outside the Hub form",
        mutate: (d) => { d.entries[0].license.tag_at_pin = "Apache License 2.0"; },
        message: "tag_at_pin must be a Hub licence tag",
      },
      {
        name: "recorded flag without its source",
        mutate: (d) => { d.entries[1].hub_flags.gated = false; },
        message: "hub_flags.observed_on must be a bounded non-empty string",
      },
      {
        name: "source outside the estate",
        mutate: (d) => { d.entries[0].pin_sources[0].repository = "someone/else"; },
        message: "must be one of the source repositories this validator names",
      },
      {
        name: "source in an estate repository the validator does not name",
        mutate: (d) => {
          d.entries[0].license.source.repository = "cambridgetcg/not-a-public-repository";
        },
        message: "license.source.repository must be one of the source repositories this validator names",
      },
      {
        name: "source repository in the wrong letter case",
        mutate: (d) => { d.entries[0].hub_flags.source.repository = "cambridgetcg/kingdom-os"; },
        message: "hub_flags.source.repository must be one of the source repositories",
      },
      {
        name: "source given as a local absolute path",
        mutate: (d) => { d.entries[0].files[0].source.path = "/home/someone/src/embedding.ts"; },
        message: "path must be a plain path inside that repository",
      },
      {
        name: "source at a short commit",
        mutate: (d) => { d.entries[2].pin_sources[0].commit = "ee91698"; },
        message: "pin_sources[0].commit must be a 40-character lowercase hex commit",
      },
      {
        name: "row without a pin source",
        mutate: (d) => { d.entries[2].pin_sources = []; },
        message: "pin_sources must be an array of 1-8 items",
      },
      {
        name: "duplicate model row",
        mutate: (d) => { d.entries.push(structuredClone(d.entries[1])); },
        message: "duplicate model rights repo id: HuggingFaceTB/SmolLM2-135M-Instruct",
      },
      {
        name: "duplicate model row that differs only in letter case",
        mutate: (d) => {
          const copy = structuredClone(d.entries[1]);
          copy.repo_id = copy.repo_id.toLowerCase();
          copy.upstream_url = `https://huggingface.co/${copy.repo_id}/tree/${copy.revision}`;
          d.entries.push(copy);
        },
        message: "duplicate model rights repo id: huggingfacetb/smollm2-135m-instruct",
      },
      {
        name: "repo id without an owner",
        mutate: (d) => {
          d.entries[1].repo_id = "SmolLM2-135M-Instruct";
          d.entries[1].upstream_url =
            `https://huggingface.co/SmolLM2-135M-Instruct/tree/${d.entries[1].revision}`;
        },
        message: "repo_id must include an owner",
      },
      {
        name: "boundary claiming the register seeds weights",
        mutate: (d) => { d.boundary.weights_published_or_seeded_by_this_register = true; },
        message: "boundary.weights_published_or_seeded_by_this_register must be false",
      },
      {
        name: "boundary dropping the not-legal-advice statement",
        mutate: (d) => { d.boundary.classes_are_working_reading_not_legal_advice = false; },
        message: "boundary.classes_are_working_reading_not_legal_advice must be true",
      },
      {
        name: "notice without the not-legal-advice sentence",
        mutate: (d) => { d.notice = ["Classes are a working reading."]; },
        message: "must say that the classes are not legal advice",
      },
      {
        name: "class key relabelled",
        mutate: (d) => { d.classes.P = "permissive"; },
        message: 'register.classes.P must be "perpetual and unrestricted"',
      },
      {
        name: "pickle added to the allowed weight formats",
        mutate: (d) => { d.formats.weights.push("pickle"); },
        message: "register.formats.weights must be exactly: safetensors, gguf, onnx",
      },
      {
        name: "wrong protocol",
        mutate: (d) => { d.protocol = "hf-kingdom-model-rights/v2"; },
        message: "register protocol must be hf-kingdom-model-rights/v1",
      },
      {
        name: "unknown top-level field",
        mutate: (d) => { d.weights = []; },
        message: "register must contain exactly",
      },
      {
        name: "unknown row field",
        mutate: (d) => { d.entries[0].magnet = "magnet:?xt=urn:btih:0"; },
        message: "register.entries[0] must contain exactly",
      },
      {
        name: "unknown file field",
        mutate: (d) => { d.entries[0].files[3].btih = "0".repeat(40); },
        message: "register.entries[0].files[3] must contain exactly",
      },
      {
        name: "unknown licence field",
        mutate: (d) => { d.entries[0].license.cleared = true; },
        message: "register.entries[0].license must contain exactly",
      },
      {
        name: "hidden non-enumerable row field",
        mutate: (d) => {
          Object.defineProperty(d.entries[0], "hidden_seed", {
            value: "must never be accepted",
            enumerable: false,
          });
        },
        message: "register.entries[0] must contain exactly",
      },
      {
        name: "symbol field inside a file",
        mutate: (d) => { d.entries[0].files[0][Symbol("seed")] = true; },
        message: "register.entries[0].files[0] contains unexpected symbol fields",
      },
    ];

    for (const testCase of cases) {
      const draft = structuredClone(register) as Draft;
      testCase.mutate(draft);
      let thrown: unknown;
      try {
        assertModelRightsRegister(draft);
      } catch (error) {
        thrown = error;
      }
      expect({ name: testCase.name, threw: thrown instanceof TypeError }).toEqual({
        name: testCase.name,
        threw: true,
      });
      expect((thrown as Error).message).toContain(testCase.message);
    }
  });

  test("stays out of the npm package and the public exports by default", async () => {
    const packageJson = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")) as {
      files: string[];
      exports: Record<string, unknown>;
    };
    expect(packageJson.files).toEqual(expect.arrayContaining([
      "!data/model-rights.v1.json",
      "!dist/model-rights.js",
      "!dist/model-rights.d.ts",
    ]));
    expect(Object.keys(packageJson.exports).some((key) => key.includes("model-rights")))
      .toBe(false);
    expect(JSON.stringify(packageJson.exports)).not.toContain("model-rights");
    const index = await readFile(resolve(ROOT, "src/index.ts"), "utf8");
    expect(index).not.toContain("model-rights");
    const verifier = await readFile(resolve(ROOT, "scripts/verify-package.ts"), "utf8");
    for (const path of [
      "data/model-rights.v1.json",
      "dist/model-rights.js",
      "dist/model-rights.d.ts",
    ]) {
      expect(verifier).toContain(`"${path}"`);
    }
  });
});
