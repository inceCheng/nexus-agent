import { modelCatalogService } from "@/server/application";
import { handleRoute } from "@/server/shared/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ providerId: string }> },
) {
  return handleRoute(async () => {
    const { providerId } = await context.params;
    const models = await modelCatalogService.listModels(providerId);
    return Response.json({ models });
  });
}
