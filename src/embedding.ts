import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  canonicalJson,
  type DataNode,
  type JsonObject,
  type RecordEnvelope,
} from "@agenttool/data";
import {
  AGGREGATE_COLLECTION,
  DTAP_COLLECTION,
  GRAPH_COLLECTION,
  RECEIPT_COLLECTION,
  RESOURCE_COLLECTION,
  SEMANTIC_COLLECTION,
} from "./store.ts";

export const EMBEDDING_REPO = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_REVISION =
  "751bff37182d3f1213fa05d7196b954e230abad9";
export const EMBEDDING_LIBRARY = "@huggingface/transformers";
export const EMBEDDING_LIBRARY_VERSION = "4.2.0";
export const EMBEDDING_DIMENSIONS = 384;
export const EMBEDDING_MAX_WORDPIECES = 256;
export const EMBEDDING_MAX_TEXTS = 32;
export const EMBEDDING_MAX_TEXT_LENGTH = 2_000;
export const EMBEDDING_MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;
export const EMBEDDING_MAX_STORED_DOCUMENTS = 64;

const HUB_ORIGIN = "https://huggingface.co";
const MODEL_DIRECTORY_NAME =
  `Xenova--all-MiniLM-L6-v2--${EMBEDDING_REVISION}`;
const AMBIENT_HUB_CREDENTIALS = [
  "HF_TOKEN",
  "HF_ACCESS_TOKEN",
  "HUGGING_FACE_HUB_TOKEN",
] as const;
const SEMANTIC_SOURCE_COLLECTIONS = new Set<string>([
  RESOURCE_COLLECTION,
  RECEIPT_COLLECTION,
  AGGREGATE_COLLECTION,
  DTAP_COLLECTION,
  GRAPH_COLLECTION,
]);
let localEmbedderActive = false;

export interface EmbeddingAsset {
  path: string;
  bytes: number;
  sha256: string;
  canonical_url: string;
}

export const EMBEDDING_ASSETS: readonly EmbeddingAsset[] = [
  {
    path: "config.json",
    bytes: 650,
    sha256: "7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7",
    canonical_url:
      `${HUB_ORIGIN}/${EMBEDDING_REPO}/resolve/${EMBEDDING_REVISION}/config.json`,
  },
  {
    path: "tokenizer.json",
    bytes: 711_661,
    sha256: "da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0",
    canonical_url:
      `${HUB_ORIGIN}/${EMBEDDING_REPO}/resolve/${EMBEDDING_REVISION}/tokenizer.json`,
  },
  {
    path: "tokenizer_config.json",
    bytes: 366,
    sha256: "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
    canonical_url:
      `${HUB_ORIGIN}/${EMBEDDING_REPO}/resolve/${EMBEDDING_REVISION}/tokenizer_config.json`,
  },
  {
    path: "onnx/model_quantized.onnx",
    bytes: 22_972_370,
    sha256: "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1",
    canonical_url:
      `${HUB_ORIGIN}/${EMBEDDING_REPO}/resolve/${EMBEDDING_REVISION}/onnx/model_quantized.onnx`,
  },
] as const;

export const EMBEDDING_MANIFEST_SHA256 = createHash("sha256")
  .update(canonicalJson(EMBEDDING_ASSETS as unknown as JsonObject[]))
  .digest("hex");

export interface EmbeddingModelProfile {
  repo_id: typeof EMBEDDING_REPO;
  revision: typeof EMBEDDING_REVISION;
  manifest_sha256: typeof EMBEDDING_MANIFEST_SHA256;
  publisher_boundary: "community-conversion-not-security-reviewed";
  library: typeof EMBEDDING_LIBRARY;
  library_version: typeof EMBEDDING_LIBRARY_VERSION;
  device: "cpu";
  dtype: "q8";
  pooling: "mean";
  normalization: "l2";
  dimensions: typeof EMBEDDING_DIMENSIONS;
  maximum_wordpieces: typeof EMBEDDING_MAX_WORDPIECES;
  language_boundary: "English semantic lane; local full-text search remains primary for Cantonese";
}

export const EMBEDDING_MODEL_PROFILE: EmbeddingModelProfile = {
  repo_id: EMBEDDING_REPO,
  revision: EMBEDDING_REVISION,
  manifest_sha256: EMBEDDING_MANIFEST_SHA256,
  publisher_boundary: "community-conversion-not-security-reviewed",
  library: EMBEDDING_LIBRARY,
  library_version: EMBEDDING_LIBRARY_VERSION,
  device: "cpu",
  dtype: "q8",
  pooling: "mean",
  normalization: "l2",
  dimensions: EMBEDDING_DIMENSIONS,
  maximum_wordpieces: EMBEDDING_MAX_WORDPIECES,
  language_boundary:
    "English semantic lane; local full-text search remains primary for Cantonese",
};

export interface EmbeddingPrepareReceipt {
  protocol: "hf-kingdom-embedding-prepare/v1";
  observed_at: string;
  disposition: "downloaded" | "existing-verified";
  model: EmbeddingModelProfile;
  assets: EmbeddingAsset[];
  total_bytes: number;
  effects: {
    remote_reads: string[];
    local_writes: string[];
    remote_writes: [];
    inference_requests: [];
    jobs_submitted: [];
    ambient_hub_credentials_used: false;
    redirect_destinations_retained: false;
  };
  limits: {
    fixed_manifest_only: true;
    maximum_download_bytes: typeof EMBEDDING_MAX_DOWNLOAD_BYTES;
    sha256_verified: true;
    local_inference_only_after_prepare: true;
  };
}

export interface PrepareEmbeddingOptions {
  fetch?: typeof fetch;
  now?: () => Date;
}

export interface LocalEmbedder {
  readonly profile: EmbeddingModelProfile;
  embed(texts: string[]): Promise<number[][]>;
  dispose(): Promise<void>;
}

export interface SemanticSource {
  source_record_id: string;
  source_content_sha256: string;
  fragment_id: string;
  title: string;
  canonical_url: string;
  text: string;
}

export interface SemanticVectorDocument {
  protocol: "hf-kingdom-semantic-vector/v1";
  observed_at: string;
  source: Omit<SemanticSource, "text">;
  model: EmbeddingModelProfile;
  vector: number[];
  classification: "derived_unverified_signal";
  boundaries: {
    source_assertions_are_untrusted: true;
    exact_source_fragment_only: true;
    English_semantic_lane: true;
    no_remote_inference: true;
  };
}

export interface SemanticSearchHit {
  score: number;
  source: SemanticVectorDocument["source"];
  classification: SemanticVectorDocument["classification"];
}

export function embeddingModelDirectory(root: string): string {
  return resolve(root, "models", MODEL_DIRECTORY_NAME);
}

/**
 * Download one fixed, revision-qualified community conversion. The caller can
 * choose only the local data root; it cannot choose a model, revision, URL,
 * filename, token, dtype, or device.
 */
export async function prepareEmbeddingAssets(
  root: string,
  options: PrepareEmbeddingOptions = {},
): Promise<EmbeddingPrepareReceipt> {
  const dataRoot = resolve(root);
  const parent = resolve(dataRoot, "models");
  const rootInfo = await localPathInfo(dataRoot);
  if (rootInfo && (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())) {
    throw new Error("embedding data root is not a plain directory");
  }
  const parentInfo = await localPathInfo(parent);
  if (parentInfo && (!parentInfo.isDirectory() || parentInfo.isSymbolicLink())) {
    throw new Error("embedding models parent is not a plain directory");
  }
  const modelDirectory = embeddingModelDirectory(root);
  const existing = await localPathInfo(modelDirectory);
  if (existing) {
    if (!existing.isDirectory() || existing.isSymbolicLink()) {
      throw new Error("embedding model path exists but is not a plain directory");
    }
    await verifyEmbeddingAssets(modelDirectory, true);
    return prepareReceipt("existing-verified", options.now, []);
  }
  assertNoAmbientHubCredentials();

  if (!rootInfo) await mkdir(dataRoot, { recursive: false });
  if (!parentInfo) await mkdir(parent, { recursive: false });
  await assertPlainDirectory(dataRoot, "embedding data root");
  await assertPlainDirectory(parent, "embedding models parent");
  const staging = join(parent, `${MODEL_DIRECTORY_NAME}.staging-${randomUUID()}`);
  await mkdir(staging, { recursive: false });

  const remoteReads: string[] = [];
  try {
    let total = 0;
    for (const asset of EMBEDDING_ASSETS) {
      total += asset.bytes;
      if (total > EMBEDDING_MAX_DOWNLOAD_BYTES) {
        throw new Error("embedding asset manifest exceeds its download limit");
      }
      const bytes = await downloadVerifiedAsset(
        asset,
        options.fetch ?? fetch,
      );
      const destination = join(staging, asset.path);
      await mkdir(resolve(destination, ".."), { recursive: true });
      await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
      remoteReads.push(asset.canonical_url);
    }
    await verifyEmbeddingAssets(staging, true);
    try {
      await rename(staging, modelDirectory);
    } catch (error) {
      if (await verifyEmbeddingAssets(modelDirectory, false)) {
        await rm(staging, { recursive: true, force: true });
      } else {
        throw error;
      }
    }
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }

  return prepareReceipt("downloaded", options.now, remoteReads);
}

export function assertNoAmbientHubCredentials(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const present = AMBIENT_HUB_CREDENTIALS.filter((name) =>
    typeof environment[name] === "string" && environment[name]!.length > 0
  );
  if (present.length > 0) {
    throw new Error(
      `embedding prepare refuses ambient Hugging Face credentials: ${present.join(", ")}`,
    );
  }
}

export async function verifyEmbeddingAssets(
  modelDirectory: string,
  throwOnFailure = true,
): Promise<boolean> {
  try {
    const directory = await lstat(modelDirectory);
    if (!directory.isDirectory() || directory.isSymbolicLink()) {
      throw new Error("embedding model path is not a plain directory");
    }
    for (const asset of EMBEDDING_ASSETS) {
      const path = join(modelDirectory, asset.path);
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.size !== asset.bytes) {
        throw new Error(`embedding asset failed its file boundary: ${asset.path}`);
      }
      const bytes = await readFile(path);
      const digest = sha256(bytes);
      if (digest !== asset.sha256) {
        throw new Error(`embedding asset failed SHA-256 verification: ${asset.path}`);
      }
    }
    return true;
  } catch (error) {
    if (throwOnFailure) throw error;
    return false;
  }
}

async function localPathInfo(
  path: string,
): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function assertPlainDirectory(path: string, label: string): Promise<void> {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${label} is not a plain directory`);
  }
}

/**
 * Construct the feature extractor with both library remote loading and its
 * fetch transport disabled. The fixed assets must already pass verification.
 */
export async function createLocalEmbedder(root: string): Promise<LocalEmbedder> {
  const modelDirectory = embeddingModelDirectory(root);
  await verifyEmbeddingAssets(modelDirectory, true);
  if (localEmbedderActive) {
    throw new Error("only one local semantic embedder may be active in a process");
  }
  localEmbedderActive = true;

  let transformers: typeof import("@huggingface/transformers");
  try {
    transformers = await import("@huggingface/transformers");
  } catch (error) {
    localEmbedderActive = false;
    throw error;
  }
  const previous = {
    allowRemoteModels: transformers.env.allowRemoteModels,
    allowLocalModels: transformers.env.allowLocalModels,
    fetch: transformers.env.fetch,
  };
  transformers.env.allowRemoteModels = false;
  transformers.env.allowLocalModels = true;
  transformers.env.fetch = (async () => {
    throw new Error("semantic inference refused a network request");
  }) as typeof transformers.env.fetch;

  let extractor: Awaited<ReturnType<typeof transformers.pipeline<"feature-extraction">>>;
  try {
    extractor = await transformers.pipeline(
      "feature-extraction",
      modelDirectory,
      {
        local_files_only: true,
        device: "cpu",
        dtype: "q8",
        subfolder: "onnx",
        model_file_name: "model",
      },
    );
  } catch (error) {
    transformers.env.allowRemoteModels = previous.allowRemoteModels;
    transformers.env.allowLocalModels = previous.allowLocalModels;
    transformers.env.fetch = previous.fetch;
    localEmbedderActive = false;
    throw error;
  }

  let disposed = false;
  return {
    profile: { ...EMBEDDING_MODEL_PROFILE },
    async embed(texts: string[]): Promise<number[][]> {
      if (disposed) throw new Error("local embedder is disposed");
      const normalized = validateEmbeddingTexts(texts);
      for (const text of normalized) {
        const encoding = extractor.tokenizer(text, {
          padding: false,
          truncation: false,
        });
        try {
          const tokenCount = encoding.input_ids.dims.at(-1);
          if (
            typeof tokenCount !== "number"
            || tokenCount < 1
            || tokenCount > EMBEDDING_MAX_WORDPIECES
          ) {
            throw new TypeError(
              `embedding text exceeds ${EMBEDDING_MAX_WORDPIECES} wordpieces`,
            );
          }
        } finally {
          disposeEncoding(encoding as unknown as Record<string, unknown>);
        }
      }
      const output = await extractor(normalized, {
        pooling: "mean",
        normalize: true,
      });
      try {
        if (
          output.dims.length !== 2
          || output.dims[0] !== normalized.length
          || output.dims[1] !== EMBEDDING_DIMENSIONS
        ) {
          throw new Error("embedding model returned an unexpected tensor shape");
        }
        const values = Array.from(output.data, Number);
        return normalized.map((_, index) =>
          validateEmbeddingVector(values.slice(
            index * EMBEDDING_DIMENSIONS,
            (index + 1) * EMBEDDING_DIMENSIONS,
          ))
        );
      } finally {
        output.dispose();
      }
    },
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      try {
        await extractor.dispose();
      } finally {
        transformers.env.allowRemoteModels = previous.allowRemoteModels;
        transformers.env.allowLocalModels = previous.allowLocalModels;
        transformers.env.fetch = previous.fetch;
        localEmbedderActive = false;
      }
    },
  };
}

export function validateEmbeddingVector(vector: readonly number[]): number[] {
  if (
    vector.length !== EMBEDDING_DIMENSIONS
    || vector.some((value) => !Number.isFinite(value))
  ) {
    throw new TypeError(
      `embedding vector must contain ${EMBEDDING_DIMENSIONS} finite numbers`,
    );
  }
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  if (norm < 0.98 || norm > 1.02) {
    throw new TypeError("embedding vector is not L2-normalized");
  }
  return [...vector];
}

export async function buildSemanticDocuments(
  sources: SemanticSource[],
  embedder: LocalEmbedder,
  now: () => Date = () => new Date(),
): Promise<SemanticVectorDocument[]> {
  if (sources.length === 0 || sources.length > EMBEDDING_MAX_TEXTS) {
    throw new TypeError(`semantic indexing requires 1-${EMBEDDING_MAX_TEXTS} sources`);
  }
  if (
    canonicalJson(embedder.profile as unknown as JsonObject)
      !== canonicalJson(EMBEDDING_MODEL_PROFILE as unknown as JsonObject)
  ) {
    throw new TypeError("semantic embedder profile does not match the fixed model");
  }
  const normalized = sources.map(validateSemanticSource);
  const unique = new Set(
    normalized.map((source) => `${source.source_record_id}\0${source.fragment_id}`),
  );
  if (unique.size !== normalized.length) {
    throw new TypeError("semantic source fragments must be unique");
  }
  const observedAt = validDate(now(), "semantic indexing clock").toISOString();
  const vectors = await embedder.embed(normalized.map((source) => source.text));
  if (vectors.length !== normalized.length) {
    throw new Error("embedder returned a different number of vectors");
  }
  return normalized.map((source, index) => ({
    protocol: "hf-kingdom-semantic-vector/v1",
    observed_at: observedAt,
    source: {
      source_record_id: source.source_record_id,
      source_content_sha256: source.source_content_sha256,
      fragment_id: source.fragment_id,
      title: source.title,
      canonical_url: source.canonical_url,
    },
    model: { ...EMBEDDING_MODEL_PROFILE },
    vector: validateEmbeddingVector(vectors[index]!),
    classification: "derived_unverified_signal",
    boundaries: {
      source_assertions_are_untrusted: true,
      exact_source_fragment_only: true,
      English_semantic_lane: true,
      no_remote_inference: true,
    },
  }));
}

export async function collectSemanticDocuments(
  node: DataNode,
  documents: SemanticVectorDocument[],
): Promise<RecordEnvelope[]> {
  if (documents.length === 0 || documents.length > EMBEDDING_MAX_TEXTS) {
    throw new TypeError("semantic document batch is outside its closed limit");
  }
  const records: RecordEnvelope[] = [];
  for (const document of documents) {
    const validated = validateSemanticDocument(document);
    assertSemanticSourceRecord(node, validated.source);
    const response = await node.collect({
      collection_id: SEMANTIC_COLLECTION,
      collector_id: "text",
      input: {
        text: canonicalJson(validated),
        media_type: "application/json",
        source_uri: validated.source.canonical_url,
        external_id:
          `${validated.source.source_record_id}:${validated.source.fragment_id}`,
        key:
          `${validated.source.source_content_sha256}:${validated.source.fragment_id}`,
        version: EMBEDDING_MANIFEST_SHA256,
        observed_at: validated.observed_at,
        metadata: {
          document_type: "semantic-vector",
          classification: validated.classification,
          model_revision: EMBEDDING_REVISION,
          source_record_id: validated.source.source_record_id,
        },
        provenance: [
          {
            activity: "local-feature-extraction",
            at: validated.observed_at,
            actor:
              `${EMBEDDING_LIBRARY}:${EMBEDDING_LIBRARY_VERSION}:cpu:q8`,
            input_ids: [validated.source.source_record_id],
          },
        ],
      } satisfies JsonObject,
    });
    const record = response.records[0];
    if (!record) throw new Error("AgentTool data node returned no semantic record");
    records.push(record);
  }
  return records;
}

export async function searchSemanticDocuments(
  node: DataNode,
  text: string,
  embedder: LocalEmbedder,
  limit = 5,
): Promise<SemanticSearchHit[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new TypeError("semantic query limit must be an integer from 1-20");
  }
  const queryText = validateEmbeddingTexts([text])[0]!;
  const records = node.store.listRecords(
    [SEMANTIC_COLLECTION],
    EMBEDDING_MAX_STORED_DOCUMENTS + 1,
  );
  if (records.length > EMBEDDING_MAX_STORED_DOCUMENTS) {
    throw new Error("semantic corpus exceeds its bounded local scan limit");
  }
  const [queryVector] = await embedder.embed([queryText]);
  if (!queryVector) throw new Error("embedder returned no query vector");

  const latest = new Map<string, {
    document: SemanticVectorDocument;
    semantic_record_id: string;
  }>();
  for (const record of records) {
    const resolved = await node.resolveRecord(record.id);
    if (resolved.content.encoding !== "utf8") {
      throw new Error("semantic record content is not UTF-8 JSON");
    }
    const document = validateSemanticDocument(JSON.parse(resolved.content.data));
    assertSemanticSourceRecord(node, document.source);
    const key = `${document.source.canonical_url}\0${document.source.fragment_id}`;
    const current = latest.get(key);
    if (
      !current
      || document.observed_at > current.document.observed_at
      || (
        document.observed_at === current.document.observed_at
        && record.id > current.semantic_record_id
      )
    ) {
      latest.set(key, {
        document,
        semantic_record_id: record.id,
      });
    }
  }
  const hits = [...latest.values()].map(({ document }) => ({
      score: dot(queryVector, document.vector),
      source: document.source,
      classification: document.classification,
  }));
  return hits
    .sort((left, right) =>
      right.score - left.score
      || compare(
        `${left.source.source_record_id}\0${left.source.fragment_id}`,
        `${right.source.source_record_id}\0${right.source.fragment_id}`,
      )
    )
    .slice(0, limit);
}

function prepareReceipt(
  disposition: EmbeddingPrepareReceipt["disposition"],
  now: (() => Date) | undefined,
  remoteReads: string[],
): EmbeddingPrepareReceipt {
  const observedAt = validDate(
    (now ?? (() => new Date()))(),
    "embedding prepare clock",
  ).toISOString();
  return {
    protocol: "hf-kingdom-embedding-prepare/v1",
    observed_at: observedAt,
    disposition,
    model: { ...EMBEDDING_MODEL_PROFILE },
    assets: EMBEDDING_ASSETS.map((asset) => ({ ...asset })),
    total_bytes: EMBEDDING_ASSETS.reduce((total, asset) => total + asset.bytes, 0),
    effects: {
      remote_reads: [...remoteReads],
      local_writes: disposition === "downloaded"
        ? ["fixed revision-qualified model assets under the local lab data root"]
        : [],
      remote_writes: [],
      inference_requests: [],
      jobs_submitted: [],
      ambient_hub_credentials_used: false,
      redirect_destinations_retained: false,
    },
    limits: {
      fixed_manifest_only: true,
      maximum_download_bytes: EMBEDDING_MAX_DOWNLOAD_BYTES,
      sha256_verified: true,
      local_inference_only_after_prepare: true,
    },
  };
}

async function downloadVerifiedAsset(
  asset: EmbeddingAsset,
  transport: typeof fetch,
): Promise<Uint8Array> {
  const url = new URL(asset.canonical_url);
  if (
    url.origin !== HUB_ORIGIN
    || url.username !== ""
    || url.password !== ""
    || url.search !== ""
    || url.hash !== ""
  ) {
    throw new Error("embedding asset URL escaped the fixed public origin");
  }
  const response = await transport(new Request(url, {
    method: "GET",
    credentials: "omit",
    redirect: "follow",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(60_000),
  }));
  if (!response.ok) {
    throw new Error(`embedding asset request failed with ${response.status}: ${asset.path}`);
  }
  const declared = response.headers.get("content-length");
  if (
    declared !== null
    && (!/^\d+$/u.test(declared) || Number(declared) > EMBEDDING_MAX_DOWNLOAD_BYTES)
  ) {
    throw new Error(`embedding asset declared an invalid size: ${asset.path}`);
  }
  const bytes = await readExactAssetBytes(response, asset.bytes, asset.path);
  if (bytes.byteLength !== asset.bytes) {
    throw new Error(`embedding asset byte count disagreed with manifest: ${asset.path}`);
  }
  if (sha256(bytes) !== asset.sha256) {
    throw new Error(`embedding asset SHA-256 disagreed with manifest: ${asset.path}`);
  }
  return bytes;
}

async function readExactAssetBytes(
  response: Response,
  expectedBytes: number,
  path: string,
): Promise<Uint8Array> {
  if (!response.body) {
    if (expectedBytes === 0) return new Uint8Array();
    throw new Error(`embedding asset returned no body: ${path}`);
  }
  const reader = response.body.getReader();
  const bytes = new Uint8Array(expectedBytes);
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const nextTotal = total + part.value.byteLength;
      if (nextTotal > expectedBytes) {
        await reader.cancel("embedding asset exceeded its fixed byte count");
        throw new Error(
          `embedding asset byte count disagreed with manifest: ${path}`,
        );
      }
      bytes.set(part.value, total);
      total = nextTotal;
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== expectedBytes) {
    throw new Error(`embedding asset byte count disagreed with manifest: ${path}`);
  }
  return bytes;
}

function validateEmbeddingTexts(texts: string[]): string[] {
  if (texts.length === 0 || texts.length > EMBEDDING_MAX_TEXTS) {
    throw new TypeError(`embedding requires 1-${EMBEDDING_MAX_TEXTS} texts`);
  }
  return texts.map((text) => {
    if (
      typeof text !== "string"
      || text.length === 0
      || text.length > EMBEDDING_MAX_TEXT_LENGTH
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)
    ) {
      throw new TypeError("embedding text is empty, over-limit, or contains controls");
    }
    return text.normalize("NFC");
  });
}

function validateSemanticSource(source: SemanticSource): SemanticSource {
  if (
    !/^[a-f0-9]{64}$/u.test(source.source_content_sha256)
    || !/^rec_[a-f0-9]{64}$/u.test(source.source_record_id)
    || !bounded(source.fragment_id, 1, 100)
    || !bounded(source.title, 1, 512)
  ) {
    throw new TypeError("semantic source identity is invalid");
  }
  const url = new URL(source.canonical_url);
  if (
    !(
      (url.protocol === "https:" && url.hostname === "huggingface.co")
      || (url.protocol === "urn:" && url.pathname.startsWith("hf-kingdom-lab:"))
    )
  ) {
    throw new TypeError("semantic source URL is outside the fixed local/public boundary");
  }
  return {
    ...source,
    source_record_id: source.source_record_id.normalize("NFC"),
    fragment_id: source.fragment_id.normalize("NFC"),
    title: source.title.normalize("NFC"),
    text: validateEmbeddingTexts([source.text])[0]!,
  };
}

function validateSemanticDocument(value: unknown): SemanticVectorDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("semantic document is not an object");
  }
  const document = value as Partial<SemanticVectorDocument>;
  if (
    document.protocol !== "hf-kingdom-semantic-vector/v1"
    || document.classification !== "derived_unverified_signal"
    || !document.source
    || !document.model
    || !document.boundaries
  ) {
    throw new TypeError("semantic document protocol or boundary is invalid");
  }
  const source = validateSemanticSource({
    ...document.source,
    text: "stored-vector-source",
  });
  if (
    canonicalJson(document.model as unknown as JsonObject)
      !== canonicalJson(EMBEDDING_MODEL_PROFILE as unknown as JsonObject)
    || document.boundaries.source_assertions_are_untrusted !== true
    || document.boundaries.exact_source_fragment_only !== true
    || document.boundaries.English_semantic_lane !== true
    || document.boundaries.no_remote_inference !== true
  ) {
    throw new TypeError("semantic document model profile or effect boundary changed");
  }
  const observedAt = exactIso(document.observed_at, "semantic observed_at");
  return {
    protocol: "hf-kingdom-semantic-vector/v1",
    observed_at: observedAt,
    source: {
      source_record_id: source.source_record_id,
      source_content_sha256: source.source_content_sha256,
      fragment_id: source.fragment_id,
      title: source.title,
      canonical_url: source.canonical_url,
    },
    model: { ...EMBEDDING_MODEL_PROFILE },
    vector: validateEmbeddingVector(document.vector ?? []),
    classification: "derived_unverified_signal",
    boundaries: {
      source_assertions_are_untrusted: true,
      exact_source_fragment_only: true,
      English_semantic_lane: true,
      no_remote_inference: true,
    },
  };
}

function assertSemanticSourceRecord(
  node: DataNode,
  source: SemanticVectorDocument["source"],
): void {
  const record = node.getRecord(source.source_record_id);
  if (!record) {
    throw new Error("semantic source AgentTool record does not exist");
  }
  if (!SEMANTIC_SOURCE_COLLECTIONS.has(record.collection_id)) {
    throw new Error("semantic source record collection is outside the allowlist");
  }
  if (record.content.sha256 !== source.source_content_sha256) {
    throw new Error("semantic source record content SHA-256 does not match");
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function disposeEncoding(encoding: Record<string, unknown>): void {
  const disposed = new Set<unknown>();
  for (const value of Object.values(encoding)) {
    if (
      value
      && typeof value === "object"
      && !disposed.has(value)
      && "dispose" in value
      && typeof value.dispose === "function"
    ) {
      disposed.add(value);
      value.dispose();
    }
  }
}

function dot(left: readonly number[], right: readonly number[]): number {
  let total = 0;
  for (let index = 0; index < EMBEDDING_DIMENSIONS; index += 1) {
    total += left[index]! * right[index]!;
  }
  return total;
}

function validDate(date: Date, label: string): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} returned an invalid date`);
  }
  return date;
}

function exactIso(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${label} is not an ISO timestamp`);
  }
  const date = validDate(new Date(value), label);
  if (date.toISOString() !== value) {
    throw new TypeError(`${label} is not an exact ISO timestamp`);
  }
  return value;
}

function bounded(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
