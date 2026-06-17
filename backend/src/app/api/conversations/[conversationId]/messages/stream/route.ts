import { z } from "zod";

import {
  agentRunnerService,
  conversationService,
  modelCatalogService,
} from "@/server/application";
import { DEFAULT_CONVERSATION_TITLE } from "@/server/modules/conversation/conversation.service";
import { BadRequestError } from "@/server/shared/errors";
import { handleRoute } from "@/server/shared/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const streamMessageSchema = z.object({
  content: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  apiKey: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  return handleRoute(async () => {
    const { conversationId } = await context.params;
    const parsed = streamMessageSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new BadRequestError("Invalid message payload");
    }

    await conversationService.appendMessage({
      conversationId,
      role: "user",
      content: parsed.data.content,
    });

    const messages = await conversationService.listMessages(conversationId);
    const conversations = await conversationService.listConversations();
    const conversation = conversations.find((item) => item.id === conversationId);
    const shouldAutoTitle =
      conversation?.title === DEFAULT_CONVERSATION_TITLE &&
      messages.filter((message) => message.role === "user").length === 1;
    const modelInfo = await modelCatalogService.findModel(
      parsed.data.providerId,
      parsed.data.modelId,
    );

    const stream = agentRunnerService.createResponseStream({
      providerId: parsed.data.providerId,
      modelId: parsed.data.modelId,
      apiKey: parsed.data.apiKey,
      modelInfo,
      messages,
      onDone: (content) =>
        conversationService.appendMessage({
          conversationId,
          role: "assistant",
          content: content || "(empty response)",
        }),
      onAfterDone: async (assistantContent) => {
        if (!shouldAutoTitle) {
          return null;
        }

        try {
          const latestConversation = (
            await conversationService.listConversations()
          ).find((item) => item.id === conversationId);

          if (latestConversation?.title !== DEFAULT_CONVERSATION_TITLE) {
            return null;
          }

          const title = await agentRunnerService.generateConversationTitle({
            providerId: parsed.data.providerId,
            modelId: parsed.data.modelId,
            apiKey: parsed.data.apiKey,
            modelInfo,
            userContent: parsed.data.content,
            assistantContent,
          });

          return conversationService.renameConversation(conversationId, {
            title,
          });
        } catch (error) {
          console.error("Failed to generate conversation title", error);
          return null;
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });
}
