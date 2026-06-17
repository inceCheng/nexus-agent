import { describe, expect, it } from "vitest";

import { buildModelRuntimeConfig } from "./model-runtime";

describe("buildModelRuntimeConfig", () => {
  it("maps native and OpenAI-compatible providers into runtime configs", () => {
    expect(
      buildModelRuntimeConfig({
        providerId: "openai",
        modelId: "gpt-5.2",
        apiKey: "sk-test",
      }),
    ).toEqual({
      kind: "openai",
      model: "gpt-5.2",
      apiKey: "sk-test",
      baseURL: undefined,
    });

    expect(
      buildModelRuntimeConfig({
        providerId: "openrouter",
        modelId: "openai/gpt-oss-120b",
        apiKey: "sk-or-test",
        providerNpm: "@ai-sdk/openai-compatible",
        apiBaseUrl: "https://openrouter.ai/api/v1",
      }),
    ).toEqual({
      kind: "openai",
      model: "openai/gpt-oss-120b",
      apiKey: "sk-or-test",
      baseURL: "https://openrouter.ai/api/v1",
    });

    expect(
      buildModelRuntimeConfig({
        providerId: "qiniu-ai",
        modelId: "qwen-plus",
        apiKey: "qiniu-test",
        providerNpm: "@ai-sdk/openai-compatible",
        apiBaseUrl: "https://api.qnaigc.com/v1",
      }),
    ).toEqual({
      kind: "openai",
      model: "qwen-plus",
      apiKey: "qiniu-test",
      baseURL: "https://api.qnaigc.com/v1",
    });

    expect(
      buildModelRuntimeConfig({
        providerId: "minimax-coding-plan",
        modelId: "claude-sonnet-4-5",
        apiKey: "minimax-test",
        providerNpm: "@ai-sdk/anthropic",
        apiBaseUrl: "https://api.minimax.io/anthropic/v1",
      }),
    ).toEqual({
      kind: "anthropic",
      model: "claude-sonnet-4-5",
      apiKey: "minimax-test",
      apiUrl: "https://api.minimax.io/anthropic/v1",
    });
  });

  it("rejects missing API keys before model construction", () => {
    expect(() =>
      buildModelRuntimeConfig({
        providerId: "anthropic",
        modelId: "claude-sonnet-4-5",
        apiKey: "   ",
      }),
    ).toThrow("API key is required");
  });

  it("explains providers that are visible in the catalog but not runnable", () => {
    expect(() =>
      buildModelRuntimeConfig({
        providerId: "vercel",
        modelId: "openai/gpt-5.2",
        apiKey: "gateway-test",
        providerNpm: "@ai-sdk/gateway",
      }),
    ).toThrow(
      "Provider vercel is available in the model catalog but is not mapped to a LangChain runtime yet",
    );
  });
});
