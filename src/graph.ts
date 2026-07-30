export const MCP_SECURITY_COLLECTION =
  "ashwinaravind/mcp-security-6a0daa2985d16eaf352ac310";
export const GRAPH_PAPER_IDS = ["2607.11086", "2606.20529"] as const;
export const GRAPH_MAX_RESPONSE_BYTES = 1024 * 1024;
export const GRAPH_MAX_COLLECTION_ITEMS = 64;
export const GRAPH_MAX_NODES = 96;
export const GRAPH_MAX_EDGES = 192;
export const GRAPH_MAX_TEXT_LENGTH = 512;
export const GRAPH_MAX_WALL_TIME_MS = 15_000;

const HUB_ORIGIN = "https://huggingface.co";
const COLLECTION_API_URL =
  `${HUB_ORIGIN}/api/collections/${MCP_SECURITY_COLLECTION}`;

export type GraphNodeKind =
  | "paper"
  | "model"
  | "dataset"
  | "space"
  | "collection"
  | "local_component";

export interface KnowledgeGraphNode {
  id: string;
  kind: GraphNodeKind;
  title: string;
  canonical_url: string;
  observed_version?: string;
  published_at?: string;
  remote_metadata_mutable: boolean;
  assertions_are_untrusted: true;
}

export interface KnowledgeGraphEdge {
  from: string;
  to: string;
  relation:
    | "observed_collection_membership"
    | "curated_design_input";
  assertion_source: "remote_observation" | "local_curator";
  observed_at: string;
  source_url: string;
}

export interface ResourceKnowledgeGraph {
  protocol: "hf-kingdom-resource-graph/v1";
  observed_at: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  observation_boundary: {
    access: "public-read-without-token";
    exact_roots_only: true;
    summaries_retained: false;
    author_profiles_retained: false;
    community_content_retained: false;
    nested_collections_followed: false;
    linked_repositories_auto_fetched: false;
    assertions_are_untrusted: true;
  };
  effects: {
    remote_reads: string[];
    remote_writes: [];
    inference_requests: [];
    jobs_submitted: [];
  };
  limits: {
    max_response_bytes: typeof GRAPH_MAX_RESPONSE_BYTES;
    max_collection_items: typeof GRAPH_MAX_COLLECTION_ITEMS;
    max_nodes: typeof GRAPH_MAX_NODES;
    max_edges: typeof GRAPH_MAX_EDGES;
    max_text_length: typeof GRAPH_MAX_TEXT_LENGTH;
    max_wall_time_ms: number;
  };
}

export interface GraphOptions {
  fetch?: typeof fetch;
  now?: () => Date;
  /** May shorten, but never extend, the built-in live deadline. */
  maxWallTimeMs?: number;
}

interface PaperObservation {
  id: string;
  title: string;
  publishedAt: string;
}

interface CollectionObservation {
  slug: string;
  title: string;
  lastUpdated: string;
  private: boolean;
  items: unknown[];
}

/**
 * Observe two exact public Paper Pages and one exact public Collection.
 * Paper abstracts, authors, comments, profiles, nested collections, and
 * linked repositories are deliberately discarded.
 */
export async function observePublicResourceGraph(
  options: GraphOptions = {},
): Promise<ResourceKnowledgeGraph> {
  const maxWallTimeMs = normalizeWallTime(options.maxWallTimeMs);
  const deadline = new AbortController();
  const timer = setTimeout(() => {
    deadline.abort("resource graph wall-time limit reached");
  }, maxWallTimeMs);
  try {
    return await observePublicResourceGraphWithinDeadline(
      options,
      deadline.signal,
      maxWallTimeMs,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function observePublicResourceGraphWithinDeadline(
  options: GraphOptions,
  deadline: AbortSignal,
  maxWallTimeMs: number,
): Promise<ResourceKnowledgeGraph> {
  const observedAt = validNow(options.now).toISOString();
  const remoteReads: string[] = [];
  const guardedFetch = createGraphFetch(
    options.fetch ?? fetch,
    remoteReads,
    deadline,
  );

  const [collection, ...papers] = await Promise.all([
    (async (): Promise<CollectionObservation> => {
      const response = await guardedFetch(COLLECTION_API_URL);
      if (!response.ok) {
        throw new Error(
          `Hugging Face Collection metadata request failed with ${response.status}`,
        );
      }
      return validateCollection(await response.json());
    })(),
    ...GRAPH_PAPER_IDS.map(async (paperId) => {
      const response = await guardedFetch(paperApiUrl(paperId));
      if (!response.ok) {
        throw new Error(`Hugging Face paper metadata request failed with ${response.status}`);
      }
      return validatePaper(await response.json(), paperId);
    }),
  ]);

  if (collection.slug !== MCP_SECURITY_COLLECTION) {
    throw new Error("Hugging Face returned a different Collection");
  }
  if (collection.private !== false) {
    throw new Error("private Collections are outside the resource graph scope");
  }
  if (!Array.isArray(collection.items)) {
    throw new Error("Hugging Face returned invalid Collection items");
  }
  if (collection.items.length > GRAPH_MAX_COLLECTION_ITEMS) {
    throw new Error("Collection exceeds the graph item limit");
  }

  const collectionNode: KnowledgeGraphNode = {
    id: `collection:${MCP_SECURITY_COLLECTION}`,
    kind: "collection",
    title: boundedText(collection.title, "Collection title"),
    canonical_url: `${HUB_ORIGIN}/collections/${MCP_SECURITY_COLLECTION}`,
    observed_version: validIsoDate(collection.lastUpdated, "Collection lastUpdated"),
    remote_metadata_mutable: true,
    assertions_are_untrusted: true,
  };
  const nodes = new Map<string, KnowledgeGraphNode>([
    [collectionNode.id, collectionNode],
  ]);
  const edges: KnowledgeGraphEdge[] = [];

  for (const item of collection.items) {
    const node = collectionItemNode(item as unknown);
    if (nodes.has(node.id)) {
      throw new Error("Collection returned a duplicate graph node");
    }
    nodes.set(node.id, node);
    edges.push({
      from: collectionNode.id,
      to: node.id,
      relation: "observed_collection_membership",
      assertion_source: "remote_observation",
      observed_at: observedAt,
      source_url: COLLECTION_API_URL,
    });
  }

  for (const paper of papers as PaperObservation[]) {
    const node: KnowledgeGraphNode = {
      id: `paper:${paper.id}`,
      kind: "paper",
      title: paper.title,
      canonical_url: `${HUB_ORIGIN}/papers/${paper.id}`,
      published_at: paper.publishedAt,
      remote_metadata_mutable: true,
      assertions_are_untrusted: true,
    };
    const existing = nodes.get(node.id);
    if (existing && (
      existing.title !== node.title
      || existing.published_at !== node.published_at
    )) {
      throw new Error("Paper metadata disagreed across exact observations");
    }
    nodes.set(node.id, node);
  }

  const components: KnowledgeGraphNode[] = [
    {
      id: "local-component:scanner-signal-ledger",
      kind: "local_component",
      title: "Scanner findings remain unverified evidence signals",
      canonical_url: "urn:hf-kingdom-lab:component:scanner-signal-ledger",
      remote_metadata_mutable: false,
      assertions_are_untrusted: true,
    },
    {
      id: "local-component:effects-receipt-preflight",
      kind: "local_component",
      title: "State ledger, effects receipt, and preflight policy boundary",
      canonical_url: "urn:hf-kingdom-lab:component:effects-receipt-preflight",
      remote_metadata_mutable: false,
      assertions_are_untrusted: true,
    },
  ];
  for (const component of components) nodes.set(component.id, component);

  edges.push(
    {
      from: "paper:2607.11086",
      to: "local-component:scanner-signal-ledger",
      relation: "curated_design_input",
      assertion_source: "local_curator",
      observed_at: observedAt,
      source_url: `${HUB_ORIGIN}/papers/2607.11086`,
    },
    {
      from: "paper:2606.20529",
      to: "local-component:effects-receipt-preflight",
      relation: "curated_design_input",
      assertion_source: "local_curator",
      observed_at: observedAt,
      source_url: `${HUB_ORIGIN}/papers/2606.20529`,
    },
  );

  if (nodes.size > GRAPH_MAX_NODES || edges.length > GRAPH_MAX_EDGES) {
    throw new Error("resource graph exceeds its closed size limits");
  }

  return {
    protocol: "hf-kingdom-resource-graph/v1",
    observed_at: observedAt,
    nodes: [...nodes.values()].sort((left, right) => compare(left.id, right.id)),
    edges: edges.sort((left, right) => compare(
      `${left.from}\0${left.relation}\0${left.to}`,
      `${right.from}\0${right.relation}\0${right.to}`,
    )),
    observation_boundary: {
      access: "public-read-without-token",
      exact_roots_only: true,
      summaries_retained: false,
      author_profiles_retained: false,
      community_content_retained: false,
      nested_collections_followed: false,
      linked_repositories_auto_fetched: false,
      assertions_are_untrusted: true,
    },
    effects: {
      remote_reads: [...new Set(remoteReads)].sort(compare),
      remote_writes: [],
      inference_requests: [],
      jobs_submitted: [],
    },
    limits: {
      max_response_bytes: GRAPH_MAX_RESPONSE_BYTES,
      max_collection_items: GRAPH_MAX_COLLECTION_ITEMS,
      max_nodes: GRAPH_MAX_NODES,
      max_edges: GRAPH_MAX_EDGES,
      max_text_length: GRAPH_MAX_TEXT_LENGTH,
      max_wall_time_ms: maxWallTimeMs,
    },
  };
}

function createGraphFetch(
  transport: typeof fetch,
  remoteReads: string[],
  deadline: AbortSignal,
): typeof fetch {
  return (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const incoming = new Request(input, init);
    const url = new URL(incoming.url);
    const allowed = url.href === COLLECTION_API_URL
      || GRAPH_PAPER_IDS.some((paperId) => url.href === paperApiUrl(paperId));
    if (
      !allowed
      || url.origin !== HUB_ORIGIN
      || url.username !== ""
      || url.password !== ""
      || url.search !== ""
      || url.hash !== ""
    ) {
      throw new Error("resource graph refused a URL outside its exact public allowlist");
    }
    if (incoming.method !== "GET" || incoming.body !== null) {
      throw new Error("resource graph permits bodyless GET requests only");
    }
    if (
      incoming.headers.has("authorization")
      || incoming.headers.has("cookie")
    ) {
      throw new Error("credentials are outside the public resource graph scope");
    }

    const requestInit: RequestInit = {
      method: "GET",
      headers: incoming.headers,
      credentials: "omit",
      redirect: "manual",
      referrerPolicy: "no-referrer",
      signal: deadline,
    };
    remoteReads.push(url.href);
    const response = await abortable(
      transport(url.href, requestInit),
      deadline,
    );
    if (response.status >= 300 && response.status < 400) {
      throw new Error("resource graph refuses redirects");
    }
    if (response.url && response.url !== url.href) {
      throw new Error("resource graph response URL escaped the exact allowlist");
    }
    const bytes = await readBounded(
      response,
      GRAPH_MAX_RESPONSE_BYTES,
      deadline,
    );
    return new Response(
      bytes.byteLength === 0 ? null : new TextDecoder().decode(bytes),
      {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      },
    );
  }) as typeof fetch;
}

async function readBounded(
  response: Response,
  limit: number,
  deadline: AbortSignal,
): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (
    !/^\d+$/u.test(declared)
    || Number(declared) > limit
  )) {
    throw new Error("resource graph response exceeds its byte limit");
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const bytes = new Uint8Array(limit);
  let total = 0;
  try {
    while (true) {
      const part = await abortable(reader.read(), deadline);
      if (part.done) break;
      const nextTotal = total + part.value.byteLength;
      if (nextTotal > limit) {
        await reader.cancel("resource graph response exceeded its byte limit");
        throw new Error("resource graph response exceeds its byte limit");
      }
      bytes.set(part.value, total);
      total = nextTotal;
    }
  } finally {
    reader.releaseLock();
  }
  return bytes.subarray(0, total);
}

function validatePaper(value: unknown, expectedId: string): PaperObservation {
  const paper = object(value, "paper");
  if (paper.id !== expectedId) {
    throw new Error("Hugging Face returned a different paper");
  }
  return {
    id: expectedId,
    title: boundedText(paper.title, "paper title"),
    publishedAt: validIsoDate(paper.publishedAt, "paper publishedAt"),
  };
}

function validateCollection(value: unknown): CollectionObservation {
  const collection = object(value, "Collection");
  if (
    collection.slug !== MCP_SECURITY_COLLECTION
    || typeof collection.private !== "boolean"
    || !Array.isArray(collection.items)
  ) {
    throw new Error("Hugging Face returned an invalid or different Collection");
  }
  return {
    slug: MCP_SECURITY_COLLECTION,
    title: boundedText(collection.title, "Collection title"),
    lastUpdated: validIsoDate(collection.lastUpdated, "Collection lastUpdated"),
    private: collection.private,
    items: [...collection.items],
  };
}

function collectionItemNode(value: unknown): KnowledgeGraphNode {
  const item = object(value, "Collection item");
  if (
    item.type === "model"
    || item.type === "dataset"
    || item.type === "space"
  ) {
    if (item.private !== false) {
      throw new Error("private Collection items are outside the graph scope");
    }
    if (typeof item.id !== "string" || !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(item.id)) {
      throw new Error("Collection returned an invalid repository id");
    }
    const prefix = item.type === "model" ? "" : `${item.type}s/`;
    return {
      id: `${item.type}:${item.id}`,
      kind: item.type,
      title: boundedText(item.id, "Collection repository id"),
      canonical_url: `${HUB_ORIGIN}/${prefix}${item.id}`,
      observed_version: validIsoDate(item.lastModified, "Collection item lastModified"),
      remote_metadata_mutable: true,
      assertions_are_untrusted: true,
    };
  }
  if (item.type === "paper") {
    if (typeof item.id !== "string" || !/^\d{4}\.\d{4,5}(?:v\d+)?$/u.test(item.id)) {
      throw new Error("Collection returned an invalid paper id");
    }
    return {
      id: `paper:${item.id}`,
      kind: "paper",
      title: boundedText(item.title, "Collection paper title"),
      canonical_url: `${HUB_ORIGIN}/papers/${item.id}`,
      published_at: validIsoDate(item.publishedAt, "Collection paper publishedAt"),
      remote_metadata_mutable: true,
      assertions_are_untrusted: true,
    };
  }
  throw new Error("nested or unknown Collection item types are outside the graph scope");
}

function boundedText(value: unknown, label: string): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > GRAPH_MAX_TEXT_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`${label} is invalid or over-limit`);
  }
  return value.normalize("NFC");
}

function validIsoDate(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} is invalid`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function validNow(now: (() => Date) | undefined): Date {
  const value = (now ?? (() => new Date()))();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("resource graph clock returned an invalid date");
  }
  return value;
}

function normalizeWallTime(value: number | undefined): number {
  if (value === undefined) return GRAPH_MAX_WALL_TIME_MS;
  if (
    !Number.isInteger(value)
    || value < 1
    || value > GRAPH_MAX_WALL_TIME_MS
  ) {
    throw new TypeError(
      `resource graph wall time must be an integer from 1-${GRAPH_MAX_WALL_TIME_MS}ms`,
    );
  }
  return value;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new Error("resource graph wall-time limit reached"));
  }
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const onAbort = (): void => {
      rejectPromise(new Error("resource graph wall-time limit reached"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolvePromise(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        rejectPromise(error);
      },
    );
  });
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function paperApiUrl(paperId: string): string {
  return `${HUB_ORIGIN}/api/papers/${paperId}`;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
