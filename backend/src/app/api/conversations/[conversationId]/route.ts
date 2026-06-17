import { z } from "zod";

import { conversationService } from "@/server/application";
import { handleRoute } from "@/server/shared/route";
import { BadRequestError } from "@/server/shared/errors";
import { serializeConversation } from "@/server/modules/agent/agent-runner.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const renameConversationSchema = z.object({
  title: z.string().min(1),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  return handleRoute(async () => {
    const { conversationId } = await context.params;
    const parsed = renameConversationSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new BadRequestError("Invalid conversation payload");
    }

    const conversation = await conversationService.renameConversation(
      conversationId,
      parsed.data,
    );

    return Response.json({
      conversation: serializeConversation(conversation),
    });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  return handleRoute(async () => {
    const { conversationId } = await context.params;
    await conversationService.deleteConversation(conversationId);
    return new Response(null, { status: 204 });
  });
}
