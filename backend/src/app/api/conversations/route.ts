import { z } from "zod";

import { conversationService } from "@/server/application";
import { BadRequestError } from "@/server/shared/errors";
import { handleRoute } from "@/server/shared/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createConversationSchema = z.object({
  title: z.string().optional(),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});

export async function GET() {
  return handleRoute(async () => {
    const conversations = await conversationService.listConversations();
    return Response.json({
      conversations: conversations.map((conversation) => ({
        ...conversation,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      })),
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const parsed = createConversationSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new BadRequestError("Invalid conversation payload");
    }

    const conversation = await conversationService.createConversation(parsed.data);

    return Response.json(
      {
        conversation: {
          ...conversation,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  });
}
