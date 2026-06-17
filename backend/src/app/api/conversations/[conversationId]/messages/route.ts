import { conversationService } from "@/server/application";
import { handleRoute } from "@/server/shared/route";
import { serializeMessage } from "@/server/modules/agent/agent-runner.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  return handleRoute(async () => {
    const { conversationId } = await context.params;
    const messages = await conversationService.listMessages(conversationId);
    return Response.json({ messages: messages.map(serializeMessage) });
  });
}
