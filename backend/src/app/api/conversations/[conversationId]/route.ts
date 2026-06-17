import { conversationService } from "@/server/application";
import { handleRoute } from "@/server/shared/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
