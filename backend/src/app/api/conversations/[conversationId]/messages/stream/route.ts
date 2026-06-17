import { z } from "zod";

import {
  agentRunnerService,
  conversationService,
  modelCatalogService,
} from "@/server/application";
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
