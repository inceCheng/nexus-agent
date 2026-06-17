import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { BadRequestError } from "@/server/shared/errors";

export type SupportedRuntimeProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter";

export interface ModelRuntimeInput {
  providerId: string;
  modelId: string;
  apiKey: string;
  providerNpm?: string | null;
  apiBaseUrl?: string | null;
}

export type ModelRuntimeConfig =
  | {
      kind: "openai";
      model: string;
      apiKey: string;
      baseURL?: string;
    }
  | {
      kind: "anthropic";
      model: string;
      apiKey: string;
      apiUrl?: string;
    }
  | {
      kind: "google";
      model: string;
      apiKey: string;
    };

export function buildModelRuntimeConfig(
  input: ModelRuntimeInput,
): ModelRuntimeConfig {
  const apiKey = input.apiKey.trim();

  if (!apiKey) {
    throw new BadRequestError("API key is required");
  }

  const providerNpm = input.providerNpm ?? null;

  if (input.providerId === "openai" || providerNpm === "@ai-sdk/openai") {
    return {
      kind: "openai",
      model: input.modelId,
      apiKey,
      baseURL: undefined,
    };
  }

  if (
    input.providerId === "openrouter" ||
    providerNpm === "@ai-sdk/openai-compatible" ||
    providerNpm === "@openrouter/ai-sdk-provider"
  ) {
    return {
      kind: "openai",
      model: input.modelId,
      apiKey,
      baseURL:
        input.apiBaseUrl ??
        (input.providerId === "openrouter"
          ? "https://openrouter.ai/api/v1"
          : undefined),
    };
  }

  if (input.providerId === "anthropic" || providerNpm === "@ai-sdk/anthropic") {
    return {
      kind: "anthropic",
      model: input.modelId,
      apiKey,
      apiUrl: input.apiBaseUrl ?? undefined,
    };
  }

  if (input.providerId === "google" || providerNpm === "@ai-sdk/google") {
    return {
      kind: "google",
      model: input.modelId,
      apiKey,
    };
  }

  throw new BadRequestError(
    `Provider ${input.providerId} is available in the model catalog but is not mapped to a LangChain runtime yet`,
  );
}

export function createChatModel(input: ModelRuntimeInput): BaseChatModel {
  const config = buildModelRuntimeConfig(input);

  if (config.kind === "openai") {
    return new ChatOpenAI({
      model: config.model,
      apiKey: config.apiKey,
      temperature: 0,
      configuration: config.baseURL
        ? {
            baseURL: config.baseURL,
          }
        : undefined,
    });
  }

  if (config.kind === "anthropic") {
    return new ChatAnthropic({
      model: config.model,
      apiKey: config.apiKey,
      temperature: 0,
      anthropicApiUrl: config.apiUrl,
    });
  }

  return new ChatGoogleGenerativeAI({
    model: config.model,
    apiKey: config.apiKey,
    temperature: 0,
  });
}
