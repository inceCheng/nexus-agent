import { describe, expect, it } from "vitest";

import { sortModelsForApi, sortProvidersForApi } from "./model-catalog.sort";

describe("model catalog API sorting", () => {
  it("sorts providers and models in memory after fetching cached rows", () => {
    expect(
      sortProvidersForApi([
        { id: "z", name: "Zulu" },
        { id: "a", name: "Alpha" },
      ]),
    ).toEqual([
      { id: "a", name: "Alpha" },
      { id: "z", name: "Zulu" },
    ]);

    expect(
      sortModelsForApi([
        { providerId: "z", name: "Beta" },
        { providerId: "a", name: "Zulu" },
        { providerId: "a", name: "Alpha" },
      ]),
    ).toEqual([
      { providerId: "a", name: "Alpha" },
      { providerId: "a", name: "Zulu" },
      { providerId: "z", name: "Beta" },
    ]);
  });
});
