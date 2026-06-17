import type {
  ModelsDevProviderMap,
  SupportedCatalog,
  SupportedModel,
  SupportedProvider,
} from "./model-catalog.types";
import type { ModelCatalogRepository } from "./model-catalog.repository";

export function buildSupportedCatalog(
  rawCatalog: ModelsDevProviderMap,
): SupportedCatalog {
  const providers: SupportedProvider[] = [];
  const models: SupportedModel[] = [];

  for (const provider of Object.values(rawCatalog)) {
    providers.push({
      id: provider.id,
      name: provider.name,
      apiBaseUrl: provider.api ?? null,
      providerNpm: provider.npm ?? null,
      envNames: provider.env,
      raw: provider,
    });

    const providerModels = Object.values(provider.models).map<SupportedModel>(
      (model) => ({
        id: model.id,
        name: model.name,
        family: model.family ?? null,
        providerId: provider.id,
        providerName: provider.name,
        providerNpm: model.provider?.npm ?? provider.npm ?? null,
        apiBaseUrl: model.provider?.api ?? provider.api ?? null,
        toolCall: model.tool_call ?? false,
        contextLimit: model.limit?.context ?? null,
        status: model.status ?? "active",
        releaseDate: model.release_date ?? null,
        raw: model,
      }),
    );

    models.push(...providerModels);
  }

  return { providers, models };
}

export function hasCompleteProviderCache(providers: unknown[]): boolean {
  return (
    providers.length > 0 &&
    providers.every((provider) => {
      const candidate = provider as Partial<SupportedProvider>;
      return (
        typeof candidate.providerNpm !== "undefined" &&
        typeof candidate.raw === "object" &&
        candidate.raw !== null &&
        typeof candidate.raw.id === "string" &&
        typeof candidate.raw.name === "string" &&
        typeof candidate.raw.models === "object" &&
        candidate.raw.models !== null
      );
    })
  );
}

const MODELS_DEV_URL = "https://models.dev/api.json";

export class ModelCatalogService {
  constructor(private readonly repository: ModelCatalogRepository) {}

  async refreshCatalog(): Promise<SupportedCatalog> {
    const response = await fetch(MODELS_DEV_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`models.dev returned ${response.status}`);
    }

    const rawCatalog = (await response.json()) as ModelsDevProviderMap;
    const catalog = buildSupportedCatalog(rawCatalog);
    await this.repository.replaceCatalog(catalog);
    return catalog;
  }

  async listProviders(): Promise<SupportedProvider[]> {
    const providers = await this.repository.listProviders();

    if (hasCompleteProviderCache(providers)) {
      return providers;
    }

    return (await this.refreshCatalog()).providers;
  }

  async listModels(providerId: string): Promise<SupportedModel[]> {
    const models = await this.repository.listModels(providerId);

    if (models.length > 0) {
      return models;
    }

    return (await this.refreshCatalog()).models.filter(
      (model) => model.providerId === providerId,
    );
  }

  async findModel(
    providerId: string,
    modelId: string,
  ): Promise<SupportedModel | null> {
    const models = await this.listModels(providerId);
    return models.find((model) => model.id === modelId) ?? null;
  }
}
