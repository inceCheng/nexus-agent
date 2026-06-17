import { createDeepAgent } from "deepagents";

import { encodeSseEvent } from "@/server/shared/sse";
import { publicErrorMessage } from "@/server/shared/route";

import type {
  ConversationDto,
  MessageDto,
} from "../conversation/conversation.repository";
import type { SupportedModel } from "../model-catalog/model-catalog.types";
import { createChatModel, type ModelRuntimeInput } from "./model-runtime";

export interface StreamAgentInput {
  providerId: string;
  modelId: string;
  apiKey: string;
  modelInfo: SupportedModel | null;
  messages: MessageDto[];
  onDone: (content: string) => Promise<MessageDto>;
  onAfterDone?: (content: string) => Promise<ConversationDto | null>;
}

export interface GenerateConversationTitleInput {
  providerId: string;
  modelId: string;
  apiKey: string;
  modelInfo: SupportedModel | null;
  userContent: string;
  assistantContent: string;
}

export type ChatModelFactory = typeof createChatModel;

export class AgentRunnerService {
  constructor(private readonly modelFactory: ChatModelFactory = createChatModel) {}

  createResponseStream(input: StreamAgentInput): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const modelFactory = this.modelFactory;

    return new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
        };

        let assistantContent = "";

        try {
          const model = modelFactory({
            providerId: input.providerId,
            modelId: input.modelId,
            apiKey: input.apiKey,
            providerNpm: input.modelInfo?.providerNpm,
            apiBaseUrl: input.modelInfo?.apiBaseUrl,
          });

          const agent = createDeepAgent({
            model,
            systemPrompt:
              "You are NexusAgent, a concise assistant. Answer directly and preserve useful structure.",
          });

          const run = await agent.streamEvents(
            {
              messages: input.messages
                .filter((message) => message.role !== "system")
                .map((message) => ({
                  role: message.role,
                  content: message.content,
                })),
            },
            { version: "v3" },
          );

          for await (const message of run.messages) {
            for await (const token of message.text) {
              assistantContent += token;
              send("message.delta", { content: token });
            }
          }

          const savedMessage = await input.onDone(assistantContent.trim());
          send("message.done", { message: serializeMessage(savedMessage) });

          if (input.onAfterDone) {
            const conversation = await input.onAfterDone(assistantContent.trim());

            if (conversation) {
              send("conversation.updated", {
                conversation: serializeConversation(conversation),
              });
            }
          }
        } catch (error) {
          send("error", { message: publicErrorMessage(error) });
        } finally {
          controller.close();
        }
      },
    });
  }

  async generateConversationTitle(
    input: GenerateConversationTitleInput,
  ): Promise<string> {
    const model = this.modelFactory(runtimeInputFromTitleInput(input));
    const response = await model.invoke([
      {
        role: "system",
        content:
          "你是对话标题生成器。根据用户问题和助手回答生成一个简洁中文标题。只输出标题，不要解释，不要标点包裹，不要超过 24 个汉字。",
      },
      {
        role: "user",
        content: `用户问题：${input.userContent}\n\n助手回答：${input.assistantContent}`,
      },
    ]);
    const title = normalizeGeneratedTitle(messageContentToText(response.content));

    return title ?? normalizeGeneratedTitle(input.userContent) ?? "新对话";
  }
}

export function serializeMessage(message: MessageDto) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}

export function serializeConversation(conversation: ConversationDto) {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function runtimeInputFromTitleInput(
  input: GenerateConversationTitleInput,
): ModelRuntimeInput {
  return {
    providerId: input.providerId,
    modelId: input.modelId,
    apiKey: input.apiKey,
    providerNpm: input.modelInfo?.providerNpm,
    apiBaseUrl: input.modelInfo?.apiBaseUrl,
  };
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          const text = record.text ?? record.content;

          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

export function normalizeGeneratedTitle(title: string): string | null {
  const normalized = title
    .replace(/\r?\n+/g, " ")
    .replace(/[*_`#>]/g, "")
    .trim()
    .replace(/^(标题|title)\s*[:：]\s*/i, "")
    .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const characters = Array.from(normalized);

  if (characters.length <= 36) {
    return normalized;
  }

  return characters.slice(0, 36).join("");
}
