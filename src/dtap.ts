import {
  datasetInfo,
  listFiles,
} from "@huggingface/hub";

export const DTAP_DATASET = "AI-Secure/DTap-Bench-Agent-Trajectories";
export const DTAP_HUB_ORIGIN = "https://huggingface.co";
export const DTAP_MAX_ENTRIES = 10_000;
export const DTAP_MAX_TREE_PAGES = 10;
export const DTAP_MAX_METADATA_RESPONSE_BYTES = 256 * 1024;
export const DTAP_MAX_TREE_RESPONSE_BYTES = 6 * 1024 * 1024;
export const DTAP_MAX_PATH_BYTES = 1_024;
export const DTAP_MAX_TOTAL_PATH_BYTES = 4 * 1024 * 1024;
export const DTAP_MAX_PATH_DEPTH = 64;
export const DTAP_MAX_OUTPUT_BUCKETS = 64;
export const DTAP_MAX_WALL_TIME_MS = 15_000;

const DTAP_API_ROOT = `/api/datasets/${DTAP_DATASET}`;
const DTAP_METADATA_PATH = `${DTAP_API_ROOT}/revision/HEAD`;
const SHA1 = /^[a-f0-9]{40}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const METADATA_EXPANSIONS = new Set([
  "downloads",
  "gated",
  "lastModified",
  "likes",
  "private",
  "sha",
]);

export interface DtapNamedCount {
  /**
   * `null` is the deterministic overflow bucket. Labels come from public,
   * untrusted repository paths and are not semantic assertions.
   */
  label: string | null;
  entries: number;
  distinct_labels: number;
}

export interface DtapDepthCount {
  depth: number;
  entries: number;
}

export interface DtapPathCensus {
  protocol: "hf-kingdom-dtap-path-census/v1";
  observed_at: string;
  source: {
    dataset_id: typeof DTAP_DATASET;
    revision: string;
    canonical_url: `https://huggingface.co/datasets/${typeof DTAP_DATASET}`;
  };
  counts: {
    entries: number;
    files: number;
    directories: number;
    unknown: number;
    declared_file_bytes: number;
    normalized_path_utf8_bytes: number;
    maximum_path_depth: number;
    by_depth: DtapDepthCount[];
    by_extension: DtapNamedCount[];
    by_top_level: DtapNamedCount[];
  };
  completeness: {
    complete: boolean;
    truncated: boolean;
    stopped_reason:
      | "entry_limit"
      | "page_limit"
      | "path_byte_limit"
      | "response_byte_limit"
      | "time_limit"
      | null;
    traversal_order: "hub-tree-order";
    truncated_counts_are_not_representative: true;
  };
  observation_boundary: {
    access: "public-read-without-token";
    transport: "@huggingface/hub:datasetInfo+listFiles";
    assertions_are_untrusted: true;
    private_resources_in_scope: false;
    hub_mutation_in_scope: false;
    file_content_read: false;
    trajectory_bodies_read: false;
    raw_paths_retained: false;
  };
  effects: {
    metadata_requests: 1;
    tree_page_requests: number;
    metadata_response_body_bytes: number;
    tree_response_body_bytes: number;
    remote_writes: [];
    redirect_following: false;
  };
  limits: {
    max_entries: typeof DTAP_MAX_ENTRIES;
    max_tree_pages: typeof DTAP_MAX_TREE_PAGES;
    max_metadata_response_body_bytes: typeof DTAP_MAX_METADATA_RESPONSE_BYTES;
    max_tree_response_body_bytes: typeof DTAP_MAX_TREE_RESPONSE_BYTES;
    max_path_bytes: typeof DTAP_MAX_PATH_BYTES;
    max_total_path_bytes: typeof DTAP_MAX_TOTAL_PATH_BYTES;
    max_path_depth: typeof DTAP_MAX_PATH_DEPTH;
    max_output_buckets_per_dimension: typeof DTAP_MAX_OUTPUT_BUCKETS;
    max_wall_time_ms: number;
    partial_results_marked_truncated: true;
    malformed_entries_fail_closed: true;
  };
}

export interface DtapCensusOptions {
  /**
   * Test seam only. The caller cannot select a repository, revision, path,
   * Hub origin, method, redirect target, or credential through this surface.
   */
  fetch?: typeof fetch;
  now?: () => Date;
  /**
   * May shorten, but never extend, the built-in live traversal deadline.
   */
  maxWallTimeMs?: number;
}

interface RequestEffects {
  metadataRequests: number;
  treePageRequests: number;
  metadataBytes: number;
  treeBytes: number;
  revision?: string;
}

interface NormalizedEntry {
  type: "file" | "directory" | "unknown";
  path: string;
  pathBytes: number;
  depth: number;
  size: number;
}

type StopReason = Exclude<
  DtapPathCensus["completeness"]["stopped_reason"],
  null
>;

class DtapCensusStop extends Error {
  readonly reason: StopReason;

  constructor(reason: StopReason, message: string) {
    super(message);
    this.name = "DtapCensusStop";
    this.reason = reason;
  }
}

class DtapByteLimitError extends Error {
  constructor() {
    super("DTap response body exceeds its byte limit");
    this.name = "DtapByteLimitError";
  }
}

/**
 * Resolve the fixed public DTap revision and census only its repository tree
 * metadata. This function has no repository-id, URL, path, token, or mutation
 * parameter, and the guarded transport refuses redirects and `/resolve` URLs.
 */
export async function censusPublicDtapPaths(
  options: DtapCensusOptions = {},
): Promise<DtapPathCensus> {
  const wallTimeMs = normalizeWallTime(options.maxWallTimeMs);
  const deadline = new AbortController();
  const timer = setTimeout(() => {
    deadline.abort("DTap census wall-time limit reached");
  }, wallTimeMs);
  const effects: RequestEffects = {
    metadataRequests: 0,
    treePageRequests: 0,
    metadataBytes: 0,
    treeBytes: 0,
  };
  const guardedFetch = createGuardedFetch(options.fetch ?? fetch, effects, deadline.signal);

  let info: Awaited<ReturnType<typeof datasetInfo<"sha">>>;
  try {
    info = await datasetInfo({
      name: DTAP_DATASET,
      additionalFields: ["sha"],
      fetch: guardedFetch,
    });
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
  if (info.name !== DTAP_DATASET) {
    clearTimeout(timer);
    throw new Error("Hugging Face returned metadata for a different dataset");
  }
  if (info.private !== false) {
    clearTimeout(timer);
    throw new Error("private Hugging Face resources are outside the DTap census scope");
  }
  if (typeof info.sha !== "string" || !SHA1.test(info.sha)) {
    clearTimeout(timer);
    throw new Error("Hugging Face returned an invalid DTap revision");
  }
  effects.revision = info.sha;

  const seenPaths = new Set<string>();
  const depths = new Map<number, number>();
  const extensions = new Map<string, number>();
  const topLevels = new Map<string, number>();
  let files = 0;
  let directories = 0;
  let unknown = 0;
  let declaredFileBytes = 0;
  let totalPathBytes = 0;
  let maximumPathDepth = 0;
  let stoppedReason: StopReason | null = null;

  try {
    for await (const rawEntry of listFiles({
      repo: {
        name: DTAP_DATASET,
        type: "dataset",
      },
      revision: info.sha,
      recursive: true,
      expand: false,
      fetch: guardedFetch,
    })) {
      if (seenPaths.size >= DTAP_MAX_ENTRIES) {
        stoppedReason = "entry_limit";
        break;
      }
      const entry = normalizeEntry(rawEntry as unknown);
      if (totalPathBytes + entry.pathBytes > DTAP_MAX_TOTAL_PATH_BYTES) {
        stoppedReason = "path_byte_limit";
        break;
      }
      totalPathBytes += entry.pathBytes;
      if (seenPaths.has(entry.path)) {
        throw new Error("DTap tree returned a duplicate normalized path");
      }
      seenPaths.add(entry.path);

      maximumPathDepth = Math.max(maximumPathDepth, entry.depth);
      increment(depths, entry.depth);
      increment(topLevels, entry.depth === 1 ? "[root]" : entry.path.split("/", 1)[0]!);

      switch (entry.type) {
        case "file":
          files += 1;
          declaredFileBytes = checkedAdd(
            declaredFileBytes,
            entry.size,
            Number.MAX_SAFE_INTEGER,
            "declared DTap file bytes",
          );
          increment(extensions, extensionBucket(entry.path));
          break;
        case "directory":
          directories += 1;
          break;
        case "unknown":
          unknown += 1;
          break;
      }
    }
  } catch (error) {
    if (error instanceof DtapCensusStop) {
      stoppedReason = error.reason;
    } else if (error instanceof DtapByteLimitError) {
      stoppedReason = "response_byte_limit";
    } else if (deadline.signal.aborted) {
      stoppedReason = "time_limit";
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }

  const observedAt = (options.now ?? (() => new Date()))();
  if (!(observedAt instanceof Date) || Number.isNaN(observedAt.getTime())) {
    throw new TypeError("DTap census clock returned an invalid date");
  }

  return {
    protocol: "hf-kingdom-dtap-path-census/v1",
    observed_at: observedAt.toISOString(),
    source: {
      dataset_id: DTAP_DATASET,
      revision: info.sha,
      canonical_url: `https://huggingface.co/datasets/${DTAP_DATASET}`,
    },
    counts: {
      entries: seenPaths.size,
      files,
      directories,
      unknown,
      declared_file_bytes: declaredFileBytes,
      normalized_path_utf8_bytes: totalPathBytes,
      maximum_path_depth: maximumPathDepth,
      by_depth: [...depths]
        .sort(([left], [right]) => left - right)
        .map(([depth, entries]) => ({ depth, entries })),
      by_extension: boundedNamedCounts(extensions),
      by_top_level: boundedNamedCounts(topLevels),
    },
    completeness: {
      complete: stoppedReason === null,
      truncated: stoppedReason !== null,
      stopped_reason: stoppedReason,
      traversal_order: "hub-tree-order",
      truncated_counts_are_not_representative: true,
    },
    observation_boundary: {
      access: "public-read-without-token",
      transport: "@huggingface/hub:datasetInfo+listFiles",
      assertions_are_untrusted: true,
      private_resources_in_scope: false,
      hub_mutation_in_scope: false,
      file_content_read: false,
      trajectory_bodies_read: false,
      raw_paths_retained: false,
    },
    effects: {
      metadata_requests: 1,
      tree_page_requests: effects.treePageRequests,
      metadata_response_body_bytes: effects.metadataBytes,
      tree_response_body_bytes: effects.treeBytes,
      remote_writes: [],
      redirect_following: false,
    },
    limits: {
      max_entries: DTAP_MAX_ENTRIES,
      max_tree_pages: DTAP_MAX_TREE_PAGES,
      max_metadata_response_body_bytes: DTAP_MAX_METADATA_RESPONSE_BYTES,
      max_tree_response_body_bytes: DTAP_MAX_TREE_RESPONSE_BYTES,
      max_path_bytes: DTAP_MAX_PATH_BYTES,
      max_total_path_bytes: DTAP_MAX_TOTAL_PATH_BYTES,
      max_path_depth: DTAP_MAX_PATH_DEPTH,
      max_output_buckets_per_dimension: DTAP_MAX_OUTPUT_BUCKETS,
      max_wall_time_ms: wallTimeMs,
      partial_results_marked_truncated: true,
      malformed_entries_fail_closed: true,
    },
  };
}

function createGuardedFetch(
  transport: typeof fetch,
  effects: RequestEffects,
  deadline: AbortSignal,
): typeof fetch {
  return (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const incoming = new Request(input, init);
    const request = new Request(incoming, {
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
      referrerPolicy: "no-referrer",
      signal: deadline,
    });
    if (request.method !== "GET" || request.body !== null) {
      throw new Error("DTap transport permits bodyless GET requests only");
    }
    if (request.headers.has("authorization") || request.headers.has("cookie")) {
      throw new Error("credentials are outside the public DTap census scope");
    }

    const requestKind = classifyAllowedUrl(new URL(request.url), effects.revision);
    if (requestKind === "metadata") {
      if (effects.metadataRequests !== 0) {
        throw new Error("DTap metadata endpoint may be read exactly once");
      }
      effects.metadataRequests += 1;
    } else {
      if (effects.treePageRequests >= DTAP_MAX_TREE_PAGES) {
        throw new DtapCensusStop(
          "page_limit",
          `DTap tree reached the ${DTAP_MAX_TREE_PAGES} page limit`,
        );
      }
      effects.treePageRequests += 1;
    }

    const response = await abortableFetch(transport, request, deadline);
    if (response.status >= 300 && response.status < 400) {
      throw new Error("DTap transport refuses redirects");
    }
    if (response.url) {
      classifyAllowedUrl(new URL(response.url), effects.revision);
    }
    const contentType = response.headers.get("content-type");
    if (response.ok && (!contentType || !/^application\/json(?:;|$)/iu.test(contentType))) {
      throw new Error("DTap Hub endpoint returned a non-JSON response");
    }

    const usedBytes = requestKind === "metadata"
      ? effects.metadataBytes
      : effects.treeBytes;
    const byteLimit = requestKind === "metadata"
      ? DTAP_MAX_METADATA_RESPONSE_BYTES
      : DTAP_MAX_TREE_RESPONSE_BYTES;
    const bytes = await readBoundedResponseBody(response, byteLimit - usedBytes);
    if (requestKind === "metadata") {
      effects.metadataBytes += bytes.byteLength;
    } else {
      effects.treeBytes += bytes.byteLength;
    }

    return new Response(bytes.byteLength === 0 ? null : bytes.buffer as ArrayBuffer, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }) as typeof fetch;
}

function classifyAllowedUrl(
  url: URL,
  revision: string | undefined,
): "metadata" | "tree" {
  if (
    url.origin !== DTAP_HUB_ORIGIN
    || url.username !== ""
    || url.password !== ""
    || url.hash !== ""
  ) {
    throw new Error("DTap transport refused a URL outside the fixed public Hub origin");
  }

  if (url.pathname === DTAP_METADATA_PATH) {
    const expansions = url.searchParams.getAll("expand");
    const keys = [...url.searchParams.keys()];
    if (
      keys.some((key) => key !== "expand")
      || expansions.length !== METADATA_EXPANSIONS.size
      || new Set(expansions).size !== METADATA_EXPANSIONS.size
      || expansions.some((value) => !METADATA_EXPANSIONS.has(value))
    ) {
      throw new Error("DTap metadata request did not match the fixed field allowlist");
    }
    return "metadata";
  }

  if (!revision || !SHA1.test(revision)) {
    throw new Error("DTap tree request was attempted before a public revision was pinned");
  }
  if (url.pathname !== `${DTAP_API_ROOT}/tree/${revision}`) {
    throw new Error("DTap transport refused a URL outside the fixed dataset tree");
  }
  const keys = [...url.searchParams.keys()];
  const cursor = url.searchParams.getAll("cursor");
  const limit = url.searchParams.getAll("limit");
  if (
    keys.some(
      (key) => key !== "recursive" && key !== "expand" && key !== "cursor" && key !== "limit",
    )
    || url.searchParams.getAll("recursive").length !== 1
    || url.searchParams.get("recursive") !== "true"
    || url.searchParams.getAll("expand").length !== 1
    || url.searchParams.get("expand") !== "false"
    || cursor.length > 1
    || (cursor.length === 1 && (cursor[0]!.length === 0 || cursor[0]!.length > 2_048))
    || (cursor.length === 0 && limit.length !== 0)
    || (cursor.length === 1 && (limit.length !== 1 || limit[0] !== "1000"))
  ) {
    throw new Error("DTap tree request did not match the fixed recursive metadata query");
  }
  return "tree";
}

async function readBoundedResponseBody(
  response: Response,
  remainingBytes: number,
): Promise<Uint8Array> {
  if (remainingBytes < 0) {
    throw new DtapByteLimitError();
  }
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/u.test(declared)) {
      throw new Error("DTap Hub endpoint returned an invalid Content-Length");
    }
    const declaredBytes = Number(declared);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > remainingBytes) {
      throw new DtapByteLimitError();
    }
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > remainingBytes) {
        await reader.cancel("DTap response body exceeded its byte limit");
        throw new DtapByteLimitError();
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

async function abortableFetch(
  transport: typeof fetch,
  request: Request,
  deadline: AbortSignal,
): Promise<Response> {
  if (deadline.aborted) {
    throw new DtapCensusStop("time_limit", "DTap census reached its wall-time limit");
  }
  return await new Promise<Response>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new DtapCensusStop("time_limit", "DTap census reached its wall-time limit"));
    };
    deadline.addEventListener("abort", onAbort, { once: true });
    void transport(request).then(
      (response) => {
        deadline.removeEventListener("abort", onAbort);
        resolve(response);
      },
      (error: unknown) => {
        deadline.removeEventListener("abort", onAbort);
        if (deadline.aborted) {
          reject(new DtapCensusStop("time_limit", "DTap census reached its wall-time limit"));
        } else {
          reject(error);
        }
      },
    );
  });
}

function normalizeWallTime(value: number | undefined): number {
  if (value === undefined) return DTAP_MAX_WALL_TIME_MS;
  if (!Number.isInteger(value) || value < 1 || value > DTAP_MAX_WALL_TIME_MS) {
    throw new TypeError(
      `maxWallTimeMs must be an integer from 1 through ${DTAP_MAX_WALL_TIME_MS}`,
    );
  }
  return value;
}

function normalizeEntry(value: unknown): NormalizedEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("DTap tree returned a non-object entry");
  }
  const entry = value as Record<string, unknown>;
  if (entry.type !== "file" && entry.type !== "directory" && entry.type !== "unknown") {
    throw new Error("DTap tree returned an invalid entry type");
  }
  if (
    typeof entry.size !== "number"
    || !Number.isSafeInteger(entry.size)
    || entry.size < 0
  ) {
    throw new Error("DTap tree returned an invalid declared file size");
  }
  if (typeof entry.path !== "string") {
    throw new Error("DTap tree returned a non-string path");
  }

  const path = entry.path.normalize("NFC");
  const pathBytes = new TextEncoder().encode(path).byteLength;
  const segments = path.split("/");
  if (
    path.length === 0
    || pathBytes > DTAP_MAX_PATH_BYTES
    || path.startsWith("/")
    || path.endsWith("/")
    || path.includes("\\")
    || CONTROL_CHARACTER.test(path)
    || segments.length > DTAP_MAX_PATH_DEPTH
    || segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error("DTap tree returned an unsafe or over-limit path");
  }

  return {
    type: entry.type,
    path,
    pathBytes,
    depth: segments.length,
    size: entry.size,
  };
}

function extensionBucket(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "[none]";
  const extension = name.slice(dot + 1).normalize("NFC").toLocaleLowerCase("en-US");
  if (
    new TextEncoder().encode(extension).byteLength > 32
    || !/^[\p{L}\p{N}_+-]+$/u.test(extension)
  ) {
    return "[other]";
  }
  return extension;
}

function increment<Key>(counts: Map<Key, number>, key: Key): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function boundedNamedCounts(counts: Map<string, number>): DtapNamedCount[] {
  const ranked = [...counts]
    .sort(([leftLabel, leftCount], [rightLabel, rightCount]) => (
      rightCount - leftCount || compareCodeUnits(leftLabel, rightLabel)
    ));
  if (ranked.length <= DTAP_MAX_OUTPUT_BUCKETS) {
    return ranked
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([label, entries]) => ({
        label,
        entries,
        distinct_labels: 1,
      }));
  }

  const retained = ranked.slice(0, DTAP_MAX_OUTPUT_BUCKETS - 1);
  const overflow = ranked.slice(DTAP_MAX_OUTPUT_BUCKETS - 1);
  return [
    ...retained
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([label, entries]) => ({
        label,
        entries,
        distinct_labels: 1,
      })),
    {
      label: null,
      entries: overflow.reduce((total, [, entries]) => total + entries, 0),
      distinct_labels: overflow.length,
    },
  ];
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function checkedAdd(
  left: number,
  right: number,
  maximum: number,
  label: string,
): number {
  const total = left + right;
  if (!Number.isSafeInteger(total) || total > maximum) {
    throw new Error(`${label} exceed the configured limit`);
  }
  return total;
}
