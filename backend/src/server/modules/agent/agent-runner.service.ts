import { createDeepAgent } from "deepagents";

import { encodeSseEvent } from "@/server/shared/sse";
import { publicErrorMessage } from "@/server/shared/route";

import type { MessageDto } from "../conversation/conversation.repository";
import type { SupportedModel } from "../model-catalog/model-catalog.types";
import { createChatModel } from "./model-runtime";

export interface StreamAgentInput {
  providerId: string;
  modelId: string;
  apiKey: string;
  modelInfo: SupportedModel | null;
  messages: MessageDto[];
  onDone: (content: string) => Promise<MessageDto>;
}

export class AgentRunnerService {
  createResponseStream(input: StreamAgentInput): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
        };

        let assistantContent = "";

        try {
          const model = createChatModel({
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
        } catch (error) {
          send("error", { message: publicErrorMessage(error) });
        } finally {
          controller.close();
        }
      },
    });
  }
}

export function serializeMessage(message: MessageDto) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}
