import { describe, expect, it } from "vitest";

import {
  buildSupportedCatalog,
  hasCompleteProviderCache,
} from "./model-catalog.service";

describe("buildSupportedCatalog", () => {
  it("keeps every provider and model from models.dev", () => {
    const rawCatalog = {
      anthropic: {
        id: "anthropic",
        name: "Anthropic",
        api: null,
        npm: "@ai-sdk/anthropic",
        env: ["ANTHROPIC_API_KEY"],
        models: {
          "claude-old": {
            id: "claude-old",
            name: "Claude Old",
            tool_call: false,
            status: "deprecated",
          },
        },
      },
      openai: {
        id: "openai",
        name: "OpenAI",
        api: null,
        npm: "@ai-sdk/openai",
        env: ["OPENAI_API_KEY"],
        models: {
          "gpt-5.2": {
            id: "gpt-5.2",
            name: "GPT-5.2",
            family: "gpt",
            tool_call: true,
            status: "active",
            limit: { context: 400000 },
            cost: { input: 1.75, output: 14 },
            release_date: "2025-12-11",
          },
          "gpt-image-only": {
            id: "gpt-image-only",
            name: "GPT Image Only",
            tool_call: false,
            status: "active",
          },
        },
      },
      openrouter: {
        id: "openrouter",
        name: "OpenRouter",
        api: "https://openrouter.ai/api/v1",
        npm: "@ai-sdk/openai-compatible",
        env: ["OPENROUTER_API_KEY"],
        models: {
          "openai/gpt-oss-120b": {
            id: "openai/gpt-oss-120b",
            name: "GPT OSS 120B",
            family: "gpt",
            tool_call: true,
            provider: {
              npm: "@ai-sdk/openai-compatible",
              api: "https://openrouter.ai/api/v1",
            },
          },
          "old-model": {
            id: "old-model",
            name: "Old Model",
            tool_call: true,
            status: "deprecated",
          },
        },
      },
      unsupported: {
        id: "replicate",
        name: "Replicate",
        api: "https://example.com",
        npm: "@ai-sdk/replicate",
        env: ["REPLICATE_API_TOKEN"],
        models: {
          "working-model": {
            id: "working-model",
            name: "Working Model",
            tool_call: true,
          },
        },
      },
    };

    const catalog = buildSupportedCatalog(rawCatalog);

    expect(catalog.providers.map((provider) => provider.id)).toEqual(expect.arrayContaining([
      "anthropic",
      "openai",
      "openrouter",
      "replicate",
    ]));
    expect(catalog.providers).toHaveLength(4);
    expect(catalog.providers.find((provider) => provider.id === "replicate")).toMatchObject({
      name: "Replicate",
      apiBaseUrl: "https://example.com",
      providerNpm: "@ai-sdk/replicate",
      envNames: ["REPLICATE_API_TOKEN"],
      raw: rawCatalog.unsupported,
    });
    expect(catalog.models.map((model) => model.id)).toEqual(expect.arrayContaining([
      "claude-old",
      "gpt-image-only",
      "gpt-5.2",
      "old-model",
      "openai/gpt-oss-120b",
      "working-model",
    ]));
    expect(catalog.models).toHaveLength(6);
    expect(catalog.models.find((model) => model.id === "gpt-5.2")).toMatchObject({
      providerId: "openai",
      providerName: "OpenAI",
      providerNpm: "@ai-sdk/openai",
      apiBaseUrl: null,
      toolCall: true,
      contextLimit: 400000,
      status: "active",
      releaseDate: "2025-12-11",
    });
    expect(catalog.models.find((model) => model.id === "gpt-image-only")).toMatchObject({
      toolCall: false,
      status: "active",
    });
    expect(catalog.models.find((model) => model.id === "old-model")).toMatchObject({
      toolCall: true,
      status: "deprecated",
    });
    expect(catalog.models.find((model) => model.id === "openai/gpt-oss-120b")).toMatchObject({
      providerId: "openrouter",
      providerNpm: "@ai-sdk/openai-compatible",
      apiBaseUrl: "https://openrouter.ai/api/v1",
    });
    expect(catalog.models.find((model) => model.id === "working-model")).toMatchObject({
      providerId: "replicate",
      providerName: "Replicate",
      providerNpm: "@ai-sdk/replicate",
      apiBaseUrl: "https://example.com",
    });
  });
});

describe("hasCompleteProviderCache", () => {
  it("rejects legacy MVP provider cache entries without raw models.dev config", () => {
    expect(
      hasCompleteProviderCache([
        {
          id: "openai",
          name: "OpenAI",
          apiBaseUrl: null,
          envNames: ["OPENAI_API_KEY"],
        },
      ]),
    ).toBe(false);
  });

  it("accepts hydrated models.dev provider cache entries", () => {
    expect(
      hasCompleteProviderCache([
        {
          id: "qiniu-ai",
          name: "Qiniu",
          apiBaseUrl: "https://api.qnaigc.com/v1",
          providerNpm: "@ai-sdk/openai-compatible",
          envNames: ["QINIU_API_KEY"],
          raw: {
            id: "qiniu-ai",
            name: "Qiniu",
            api: "https://api.qnaigc.com/v1",
            npm: "@ai-sdk/openai-compatible",
            env: ["QINIU_API_KEY"],
            models: {
              qwen: {
                id: "qwen",
                name: "Qwen",
              },
            },
          },
        },
      ]),
    ).toBe(true);
  });
});
