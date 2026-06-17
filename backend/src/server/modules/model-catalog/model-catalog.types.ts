export type ModelsDevProviderMap = Record<string, ModelsDevProvider>;

export interface ModelsDevProvider {
  id: string;
  name: string;
  api?: string | null;
  npm?: string;
  env: string[];
  models: Record<string, ModelsDevModel>;
}

export interface ModelsDevModel {
  id: string;
  name: string;
  family?: string;
  tool_call?: boolean;
  status?: string;
  release_date?: string;
  limit?: {
    context?: number;
    input?: number;
    output?: number;
  };
  cost?: Record<string, unknown>;
  provider?: {
    npm?: string;
    api?: string | null;
  };
}

export interface SupportedProvider {
  id: string;
  name: string;
  apiBaseUrl: string | null;
  providerNpm: string | null;
  envNames: string[];
  raw: ModelsDevProvider;
}

export interface SupportedModel {
  id: string;
  name: string;
  family: string | null;
  providerId: string;
  providerName: string;
  providerNpm: string | null;
  apiBaseUrl: string | null;
  toolCall: boolean;
  contextLimit: number | null;
  status: string;
  releaseDate: string | null;
  raw: ModelsDevModel;
}

export interface SupportedCatalog {
  providers: SupportedProvider[];
  models: SupportedModel[];
}
