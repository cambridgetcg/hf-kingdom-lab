import { describe, expect, test } from "bun:test";
import {
  censusPublicDtapPaths,
  DTAP_DATASET,
  DTAP_MAX_ENTRIES,
  DTAP_MAX_METADATA_RESPONSE_BYTES,
} from "../src/dtap.ts";

const REVISION = "a".repeat(40);

function metadata(privateResource = false): Record<string, unknown> {
  return {
    _id: "public-dtap-object",
    id: DTAP_DATASET,
    private: privateResource,
    gated: false,
    downloads: 1,
    likes: 1,
    lastModified: "2026-07-30T00:00:00.000Z",
    sha: REVISION,
  };
}

function fixedClock(): Date {
  return new Date("2026-07-30T15:30:00.000Z");
}

describe("bounded public DTap path census", () => {
  test("pins the public revision and aggregates path metadata without credentials or bodies", async () => {
    const requests: Request[] = [];
    const firstTreePage = [
      { type: "file", path: "README.md", size: 100, oid: "ignored" },
      { type: "directory", path: "trajectories", size: 0 },
      { type: "file", path: "trajectories/a/trace.JSON", size: 1_000 },
    ];
    const secondTreePage = [
      { type: "file", path: "trajectories/a/notes", size: 10 },
      { type: "unknown", path: "future-entry", size: 0 },
    ];

    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      const request = input instanceof Request ? input : new Request(input);
      requests.push(request);
      if (request.url.includes("/revision/HEAD?")) {
        return Response.json(metadata());
      }
      if (request.url.includes("cursor=page-2")) {
        return Response.json(secondTreePage);
      }
      const next = new URL(request.url);
      next.searchParams.set("cursor", "page-2");
      next.searchParams.set("limit", "1000");
      return Response.json(firstTreePage, {
        headers: { Link: `<${next.href}>; rel="next"` },
      });
    }) as typeof fetch;

    const census = await censusPublicDtapPaths({
      fetch: fakeFetch,
      now: fixedClock,
    });

    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.method).toBe("GET");
      expect(request.body).toBeNull();
      expect(request.redirect).toBe("manual");
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("cookie")).toBeNull();
      expect(request.url).toStartWith("https://huggingface.co/api/datasets/");
      expect(request.url).not.toContain("/resolve/");
    }
    expect(census).toMatchObject({
      protocol: "hf-kingdom-dtap-path-census/v1",
      observed_at: "2026-07-30T15:30:00.000Z",
      source: {
        dataset_id: DTAP_DATASET,
        revision: REVISION,
      },
      counts: {
        entries: 5,
        files: 3,
        directories: 1,
        unknown: 1,
        declared_file_bytes: 1_110,
        maximum_path_depth: 3,
        by_depth: [
          { depth: 1, entries: 3 },
          { depth: 3, entries: 2 },
        ],
        by_extension: [
          { label: "[none]", entries: 1, distinct_labels: 1 },
          { label: "json", entries: 1, distinct_labels: 1 },
          { label: "md", entries: 1, distinct_labels: 1 },
        ],
        by_top_level: [
          { label: "[root]", entries: 3, distinct_labels: 1 },
          { label: "trajectories", entries: 2, distinct_labels: 1 },
        ],
      },
      completeness: {
        complete: true,
        truncated: false,
        stopped_reason: null,
        traversal_order: "hub-tree-order",
        truncated_counts_are_not_representative: true,
      },
      observation_boundary: {
        access: "public-read-without-token",
        assertions_are_untrusted: true,
        private_resources_in_scope: false,
        hub_mutation_in_scope: false,
        file_content_read: false,
        trajectory_bodies_read: false,
        raw_paths_retained: false,
      },
      effects: {
        metadata_requests: 1,
        tree_page_requests: 2,
        remote_writes: [],
        redirect_following: false,
      },
      limits: {
        partial_results_marked_truncated: true,
        malformed_entries_fail_closed: true,
      },
    });
    expect(census.counts.normalized_path_utf8_bytes).toBe(
      [
        "README.md",
        "trajectories",
        "trajectories/a/trace.JSON",
        "trajectories/a/notes",
        "future-entry",
      ].reduce((total, path) => total + new TextEncoder().encode(path).byteLength, 0),
    );
    expect(census.effects.metadata_response_body_bytes).toBeGreaterThan(0);
    expect(census.effects.tree_response_body_bytes).toBeGreaterThan(0);
  });

  test("refuses a private metadata response before requesting the tree", async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      return Response.json(metadata(true));
    }) as unknown as typeof fetch;

    await expect(censusPublicDtapPaths({ fetch: fakeFetch })).rejects.toThrow(
      "private Hugging Face resources are outside",
    );
    expect(calls).toBe(1);
  });

  test("refuses pagination away from the fixed dataset tree before making that request", async () => {
    const requestedUrls: string[] = [];
    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      const request = input instanceof Request ? input : new Request(input);
      requestedUrls.push(request.url);
      if (request.url.includes("/revision/HEAD?")) {
        return Response.json(metadata());
      }
      return Response.json(
        [{ type: "file", path: "safe.json", size: 1 }],
        { headers: { Link: '<https://example.invalid/trajectory.json>; rel="next"' } },
      );
    }) as typeof fetch;

    await expect(censusPublicDtapPaths({ fetch: fakeFetch })).rejects.toThrow(
      "outside the fixed public Hub origin",
    );
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls).not.toContain("https://example.invalid/trajectory.json");
  });

  test("refuses redirects instead of following a body URL", async () => {
    let calls = 0;
    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      calls += 1;
      const request = input instanceof Request ? input : new Request(input);
      if (request.url.includes("/revision/HEAD?")) {
        return Response.json(metadata());
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://huggingface.co/datasets/${DTAP_DATASET}/resolve/main/trajectory.json`,
        },
      });
    }) as typeof fetch;

    await expect(censusPublicDtapPaths({ fetch: fakeFetch })).rejects.toThrow(
      "refuses redirects",
    );
    expect(calls).toBe(2);
  });

  test("rejects unsafe paths, duplicate normalized paths, and invalid sizes", async () => {
    async function runWithEntries(entries: unknown[]): Promise<void> {
      const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
        const request = input instanceof Request ? input : new Request(input);
        return request.url.includes("/revision/HEAD?")
          ? Response.json(metadata())
          : Response.json(entries);
      }) as typeof fetch;
      await censusPublicDtapPaths({ fetch: fakeFetch });
    }

    await expect(runWithEntries([
      { type: "file", path: "../trajectory.json", size: 1 },
    ])).rejects.toThrow("unsafe or over-limit path");
    await expect(runWithEntries([
      { type: "file", path: "café.json", size: 1 },
      { type: "file", path: "cafe\u0301.json", size: 1 },
    ])).rejects.toThrow("duplicate normalized path");
    await expect(runWithEntries([
      { type: "file", path: "trajectory.json", size: -1 },
    ])).rejects.toThrow("invalid declared file size");
  });

  test("fails before reading a metadata response declared over the byte cap", async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      return Response.json(metadata(), {
        headers: {
          "Content-Length": String(DTAP_MAX_METADATA_RESPONSE_BYTES + 1),
        },
      });
    }) as unknown as typeof fetch;

    await expect(censusPublicDtapPaths({ fetch: fakeFetch })).rejects.toThrow(
      "response body exceeds its byte limit",
    );
    expect(calls).toBe(1);
  });

  test("stops at the entry cap and labels the partial counts as non-representative", async () => {
    const entries = Array.from({ length: DTAP_MAX_ENTRIES + 1 }, (_, index) => ({
      type: "file",
      path: `trajectories/${index}.json`,
      size: 1,
    }));
    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      const request = input instanceof Request ? input : new Request(input);
      return request.url.includes("/revision/HEAD?")
        ? Response.json(metadata())
        : Response.json(entries);
    }) as typeof fetch;

    const census = await censusPublicDtapPaths({
      fetch: fakeFetch,
      now: fixedClock,
    });

    expect(census.counts.entries).toBe(DTAP_MAX_ENTRIES);
    expect(census.completeness).toEqual({
      complete: false,
      truncated: true,
      stopped_reason: "entry_limit",
      traversal_order: "hub-tree-order",
      truncated_counts_are_not_representative: true,
    });
  });

  test("enforces a caller-shortened wall clock even when an injected transport hangs", async () => {
    let calls = 0;
    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      calls += 1;
      const request = input instanceof Request ? input : new Request(input);
      if (request.url.includes("/revision/HEAD?")) {
        return Response.json(metadata());
      }
      return await new Promise<Response>(() => {});
    }) as typeof fetch;

    const census = await censusPublicDtapPaths({
      fetch: fakeFetch,
      maxWallTimeMs: 5,
      now: fixedClock,
    });

    expect(calls).toBe(2);
    expect(census.completeness).toMatchObject({
      complete: false,
      truncated: true,
      stopped_reason: "time_limit",
    });
    expect(census.limits.max_wall_time_ms).toBe(5);
  });
});
