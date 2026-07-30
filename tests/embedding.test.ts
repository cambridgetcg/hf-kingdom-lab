import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertNoAmbientHubCredentials,
  buildSemanticDocuments,
  collectSemanticDocuments,
  EMBEDDING_ASSETS,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MANIFEST_SHA256,
  EMBEDDING_MODEL_PROFILE,
  EMBEDDING_REVISION,
  embeddingModelDirectory,
  prepareEmbeddingAssets,
  searchSemanticDocuments,
  validateEmbeddingVector,
  verifyEmbeddingAssets,
  type LocalEmbedder,
} from "../src/embedding.ts";
import {
  collectLabJson,
  GRAPH_COLLECTION,
  openLabNode,
} from "../src/store.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })
  ));
});

describe("fixed local semantic lane", () => {
  test("pins a closed 23.7 MB manifest and refuses ambient Hub credentials", () => {
    expect(EMBEDDING_ASSETS.reduce((total, asset) => total + asset.bytes, 0))
      .toBe(23_685_047);
    expect(EMBEDDING_ASSETS).toHaveLength(4);
    expect(EMBEDDING_ASSETS.every((asset) =>
      asset.canonical_url.includes(EMBEDDING_REVISION)
      && /^[a-f0-9]{64}$/u.test(asset.sha256)
    )).toBe(true);
    expect(EMBEDDING_MANIFEST_SHA256).toMatch(/^[a-f0-9]{64}$/u);
    expect(() => assertNoAmbientHubCredentials({
      HF_TOKEN: "present-but-never-read-or-reported",
    })).toThrow("HF_TOKEN");
    expect(() => assertNoAmbientHubCredentials({})).not.toThrow();
  });

  test("validates normalized 384-dimensional vectors", () => {
    expect(validateEmbeddingVector(unit(0))).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(() => validateEmbeddingVector(Array(EMBEDDING_DIMENSIONS).fill(0)))
      .toThrow("not L2-normalized");
    expect(() => validateEmbeddingVector([1])).toThrow("384");
  });

  test("refuses an existing invalid model directory without downloading", async () => {
    const root = await mkdtemp(join(tmpdir(), "hf-kingdom-invalid-model-"));
    roots.push(root);
    const directory = embeddingModelDirectory(root);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "config.json"), "invalid");
    let fetchCalls = 0;
    await expect(prepareEmbeddingAssets(root, {
      fetch: (async () => {
        fetchCalls += 1;
        throw new Error("must not fetch");
      }) as unknown as typeof fetch,
    })).rejects.toThrow("file boundary");
    expect(fetchCalls).toBe(0);
  });

  test("refuses a symlinked models parent before downloading", async () => {
    const root = await mkdtemp(join(tmpdir(), "hf-kingdom-symlink-root-"));
    const outside = await mkdtemp(join(tmpdir(), "hf-kingdom-symlink-target-"));
    roots.push(root, outside);
    await symlink(outside, join(root, "models"), "dir");
    let fetchCalls = 0;
    await expect(prepareEmbeddingAssets(root, {
      fetch: (async () => {
        fetchCalls += 1;
        throw new Error("must not fetch");
      }) as unknown as typeof fetch,
    })).rejects.toThrow("models parent is not a plain directory");
    expect(fetchCalls).toBe(0);
  });

  test("stores source-bound vectors and ranks them with a bounded local scan", async () => {
    const root = await mkdtemp(join(tmpdir(), "hf-kingdom-embedding-"));
    roots.push(root);
    expect(await verifyEmbeddingAssets(root, false)).toBe(false);
    const node = await openLabNode(root);
    const embedder = fakeEmbedder();
    try {
      const observedAt = "2026-07-30T12:00:00.000Z";
      const securitySource = await collectLabJson(node, {
        collection_id: GRAPH_COLLECTION,
        document: { kind: "paper", title: "Scanner evidence" },
        source_uri: "https://huggingface.co/papers/2607.11086",
        external_id: "paper:2607.11086",
        key: "paper:2607.11086",
        version: "fixture-1",
        observed_at: observedAt,
        metadata: { document_type: "test-source" },
        provenance: [{
          activity: "fixture",
          at: observedAt,
          actor: "test",
          input_ids: [],
        }],
      });
      const ledgerSource = await collectLabJson(node, {
        collection_id: GRAPH_COLLECTION,
        document: { kind: "local_component", title: "Effects receipt" },
        source_uri: "urn:hf-kingdom-lab:component:receipt",
        external_id: "local-component:receipt",
        key: "local-component:receipt",
        version: "fixture-1",
        observed_at: observedAt,
        metadata: { document_type: "test-source" },
        provenance: [{
          activity: "fixture",
          at: observedAt,
          actor: "test",
          input_ids: [],
        }],
      });
      const documents = await buildSemanticDocuments([
        {
          source_record_id: securitySource.record.id,
          source_content_sha256: securitySource.record.content.sha256,
          fragment_id: "scanner",
          title: "Scanner evidence",
          canonical_url: "https://huggingface.co/papers/2607.11086",
          text: "security scanner evidence",
        },
        {
          source_record_id: ledgerSource.record.id,
          source_content_sha256: ledgerSource.record.content.sha256,
          fragment_id: "receipt",
          title: "Effects receipt",
          canonical_url: "urn:hf-kingdom-lab:component:receipt",
          text: "accounting ledger receipt",
        },
      ], embedder, () => new Date(observedAt));
      const missingSource = structuredClone(documents[0]!);
      missingSource.source.source_record_id = `rec_${"d".repeat(64)}`;
      await expect(collectSemanticDocuments(node, [missingSource]))
        .rejects.toThrow("does not exist");
      const wrongDigest = structuredClone(documents[0]!);
      wrongDigest.source.source_content_sha256 = "c".repeat(64);
      await expect(collectSemanticDocuments(node, [wrongDigest]))
        .rejects.toThrow("does not match");
      const records = await collectSemanticDocuments(node, documents);
      expect(records).toHaveLength(2);

      const hits = await searchSemanticDocuments(
        node,
        "security evidence query",
        embedder,
        2,
      );
      expect(hits).toHaveLength(2);
      expect(hits[0]?.source.fragment_id).toBe("scanner");
      expect(hits[0]?.score).toBe(1);
      expect(hits.every((hit) =>
        hit.classification === "derived_unverified_signal"
      )).toBe(true);
      expect(hits[0]).not.toHaveProperty("vector");
    } finally {
      await embedder.dispose();
      node.close();
    }
  });
});

function fakeEmbedder(): LocalEmbedder {
  return {
    profile: { ...EMBEDDING_MODEL_PROFILE },
    async embed(texts: string[]): Promise<number[][]> {
      return texts.map((text) => unit(text.includes("security") ? 0 : 1));
    },
    async dispose(): Promise<void> {
      return;
    },
  };
}

function unit(index: number): number[] {
  return Array.from(
    { length: EMBEDDING_DIMENSIONS },
    (_, position) => position === index ? 1 : 0,
  );
}
