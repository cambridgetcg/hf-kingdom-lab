import { describe, expect, test } from "bun:test";
import {
  assertRepoId,
  observePublicResource,
} from "../src/hub.ts";

describe("public Hugging Face observation", () => {
  test("rejects URLs and nested paths as repo ids", () => {
    expect(() => assertRepoId("https://huggingface.co/openai/gpt-oss")).toThrow();
    expect(() => assertRepoId("owner/name/extra")).toThrow();
    expect(() => assertRepoId("../secret")).toThrow();
  });

  test("omits credentials and normalizes a model response", async () => {
    let authorization: string | null = "not-called";
    const fakeFetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const headers = new Headers(init?.headers);
      authorization = headers.get("authorization");
      expect(String(input)).toContain("/api/models/demo/model/revision/HEAD");
      return Response.json({
        _id: "object-1",
        id: "demo/model",
        private: false,
        gated: false,
        pipeline_tag: "text-generation",
        downloads: 42,
        likes: 7,
        lastModified: "2026-07-30T00:00:00.000Z",
        createdAt: "2026-07-01T00:00:00.000Z",
        author: "demo",
        disabled: false,
        library_name: "transformers",
        safetensors: { total: 123, parameters: {} },
        sha: "abc123",
        tags: ["zeta", "alpha", "alpha"],
      });
    }) as typeof fetch;

    const snapshot = await observePublicResource("model", "demo/model", {
      fetch: fakeFetch,
    });

    expect(authorization).toBeNull();
    expect(snapshot.observation_boundary.access).toBe("public-read-without-token");
    expect(snapshot.resource).toMatchObject({
      resource_type: "model",
      repo_id: "demo/model",
      private: false,
      downloads: 42,
      task: "text-generation",
      library: "transformers",
      revision: "abc123",
      tags: ["alpha", "zeta"],
    });
  });

  test("refuses a private response even when metadata is returned", async () => {
    const fakeFetch = (async () => Response.json({
      _id: "object-private",
      id: "demo/private",
      private: true,
      gated: false,
      downloads: 0,
      likes: 0,
      lastModified: "2026-07-30T00:00:00.000Z",
    })) as unknown as typeof fetch;

    await expect(
      observePublicResource("dataset", "demo/private", { fetch: fakeFetch }),
    ).rejects.toThrow("private Hugging Face resources are outside");
  });
});
