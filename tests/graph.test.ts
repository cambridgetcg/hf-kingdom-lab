import { describe, expect, test } from "bun:test";
import {
  GRAPH_MAX_COLLECTION_ITEMS,
  GRAPH_MAX_WALL_TIME_MS,
  GRAPH_PAPER_IDS,
  MCP_SECURITY_COLLECTION,
  observePublicResourceGraph,
} from "../src/graph.ts";

const COLLECTION_URL =
  `https://huggingface.co/api/collections/${MCP_SECURITY_COLLECTION}`;

describe("bounded public Hugging Face resource graph", () => {
  test("keeps exact public metadata and explicit provenance edges only", async () => {
    const requests: Array<{ request: Request; credentials?: RequestCredentials }> = [];
    const graph = await observePublicResourceGraph({
      now: () => new Date("2026-07-30T12:00:00.000Z"),
      fetch: fixtureFetch(requests),
    });

    expect(requests.map(({ request }) => request.url).sort()).toEqual([
      COLLECTION_URL,
      ...GRAPH_PAPER_IDS.map((id) => `https://huggingface.co/api/papers/${id}`),
    ].sort());
    expect(requests.every(({ request, credentials }) =>
      request.method === "GET"
      && credentials === "omit"
      && !request.headers.has("authorization")
      && !request.headers.has("cookie")
    )).toBe(true);
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "collection:ashwinaravind/mcp-security-6a0daa2985d16eaf352ac310",
      "local-component:effects-receipt-preflight",
      "local-component:scanner-signal-ledger",
      "paper:2605.16265",
      "paper:2606.20529",
      "paper:2607.11086",
    ]);
    expect(graph.edges).toHaveLength(3);
    expect(graph.observation_boundary).toEqual(expect.objectContaining({
      summaries_retained: false,
      author_profiles_retained: false,
      community_content_retained: false,
      assertions_are_untrusted: true,
    }));
    expect(JSON.stringify(graph)).not.toContain("discard-this-abstract");
    expect(JSON.stringify(graph)).not.toContain("discard-this-author");
    expect(graph.effects.remote_writes).toEqual([]);
    expect(graph.limits.max_wall_time_ms).toBe(GRAPH_MAX_WALL_TIME_MS);
  });

  test("refuses redirects and Collection expansion beyond its cap", async () => {
    await expect(observePublicResourceGraph({
      fetch: (async () => new Response(null, {
        status: 302,
        headers: { location: "https://example.test/escape" },
      })) as unknown as typeof fetch,
    })).rejects.toThrow("refuses redirects");

    await expect(observePublicResourceGraph({
      fetch: fixtureFetch([], GRAPH_MAX_COLLECTION_ITEMS + 1),
    })).rejects.toThrow("graph item limit");
  });

  test("enforces a caller-shortened wall clock even if a transport hangs", async () => {
    await expect(observePublicResourceGraph({
      maxWallTimeMs: 5,
      fetch: (() => new Promise<Response>(() => {
        // Deliberately never settles and ignores the AbortSignal.
      })) as unknown as typeof fetch,
    })).rejects.toThrow("wall-time limit");
  });
});

function fixtureFetch(
  requests: Array<{ request: Request; credentials?: RequestCredentials }>,
  itemCount = 1,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({
      request,
      ...(init?.credentials ? { credentials: init.credentials } : {}),
    });
    if (request.url === COLLECTION_URL) {
      return json({
        slug: MCP_SECURITY_COLLECTION,
        private: false,
        title: "MCP Security",
        lastUpdated: "2026-05-20T12:36:40.415Z",
        description: "discard-this-abstract",
        owner: { name: "discard-this-author" },
        items: Array.from({ length: itemCount }, (_, index) => ({
          id: index === 0 ? "2605.16265" : `2605.${String(20_000 + index)}`,
          type: "paper",
          title: `Security paper ${index}`,
          publishedAt: "2026-05-20T00:00:00.000Z",
        })),
      });
    }
    const paperId = request.url.split("/").at(-1)!;
    return json({
      id: paperId,
      title: paperId === "2607.11086"
        ? "MCP scanner reliability"
        : "LedgerAgent",
      publishedAt: "2026-07-01T00:00:00.000Z",
      summary: "discard-this-abstract",
      authors: ["discard-this-author"],
    });
  }) as typeof fetch;
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
