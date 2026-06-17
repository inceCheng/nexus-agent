import { modelCatalogService } from "@/server/application";
import { handleRoute } from "@/server/shared/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const providers = await modelCatalogService.listProviders();
    return Response.json({ providers });
  });
}
