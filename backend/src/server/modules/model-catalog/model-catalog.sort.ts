type ProviderSortable = {
  id: string;
  name: string;
};

type ModelSortable = {
  providerId: string;
  name: string;
};

export function sortProvidersForApi<T extends ProviderSortable>(
  providers: T[],
): T[] {
  return [...providers].sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );
}

export function sortModelsForApi<T extends ModelSortable>(models: T[]): T[] {
  return [...models].sort((left, right) => {
    const providerOrder = left.providerId.localeCompare(right.providerId, "en", {
      sensitivity: "base",
    });

    if (providerOrder !== 0) {
      return providerOrder;
    }

    return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
  });
}
