import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/shared/prisma";

import type {
  SupportedCatalog,
  SupportedModel,
  SupportedProvider,
} from "./model-catalog.types";
import { sortModelsForApi, sortProvidersForApi } from "./model-catalog.sort";

export interface ModelCatalogRepository {
  replaceCatalog(catalog: SupportedCatalog): Promise<void>;
  listProviders(): Promise<SupportedProvider[]>;
  listModels(providerId?: string): Promise<SupportedModel[]>;
}

export class PrismaModelCatalogRepository implements ModelCatalogRepository {
  async replaceCatalog(catalog: SupportedCatalog): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.modelCache.deleteMany();
      await tx.modelProviderCache.deleteMany();

      if (catalog.providers.length > 0) {
        await tx.modelProviderCache.createMany({
          data: catalog.providers.map((provider) => ({
            providerId: provider.id,
            name: provider.name,
            apiBaseUrl: provider.apiBaseUrl,
            envNames: provider.envNames as Prisma.InputJsonValue,
            rawJson: provider as unknown as Prisma.InputJsonValue,
          })),
        });
      }

      if (catalog.models.length > 0) {
        for (const modelChunk of chunks(catalog.models, 500)) {
          await tx.modelCache.createMany({
            data: modelChunk.map((model) => ({
              providerId: model.providerId,
              modelId: model.id,
              name: model.name,
              family: model.family,
              toolCall: model.toolCall,
              contextLimit: model.contextLimit,
              status: model.status,
              rawJson: model as unknown as Prisma.InputJsonValue,
            })),
          });
        }
      }
    }, { timeout: 30_000 });
  }

  async listProviders(): Promise<SupportedProvider[]> {
    const providers = await prisma.modelProviderCache.findMany();

    return sortProvidersForApi(providers.map((provider) => ({
      ...(provider.rawJson as unknown as SupportedProvider),
      id: provider.providerId,
      name: provider.name,
      apiBaseUrl: provider.apiBaseUrl,
      envNames: provider.envNames as string[],
    })));
  }

  async listModels(providerId?: string): Promise<SupportedModel[]> {
    const models = await prisma.modelCache.findMany({
      where: providerId ? { providerId } : undefined,
    });

    return sortModelsForApi(models.map((model) => {
      const raw = model.rawJson as unknown as SupportedModel;
      return {
        ...raw,
        id: model.modelId,
        name: model.name,
        providerId: model.providerId,
        family: model.family,
        toolCall: model.toolCall,
        contextLimit: model.contextLimit,
        status: model.status,
      };
    }));
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}
