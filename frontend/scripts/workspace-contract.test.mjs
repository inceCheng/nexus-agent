import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  resolve(__dirname, "../src/components/nexus-workspace.tsx"),
  "utf8",
);

describe("NexusWorkspace behavior contract", () => {
  it("keeps model settings global instead of restoring them from active conversations", () => {
    assert.doesNotMatch(
      source,
      /setProviderId\(\s*activeConversation\.providerId\s*\)/,
      "switching conversations should not overwrite the global provider setting",
    );
    assert.doesNotMatch(
      source,
      /setModelId\(\s*activeConversation\.modelId\s*\)/,
      "switching conversations should not overwrite the global model setting",
    );
  });

  it("supports deleting conversations from the sidebar", () => {
    assert.match(
      source,
      /method:\s*"DELETE"/,
      "sidebar deletion should call the DELETE conversation API",
    );
    assert.match(
      source,
      /DeleteOutlined/,
      "sidebar deletion should expose a visible delete affordance",
    );
  });

  it("requires confirming model settings before they become active", () => {
    assert.match(
      source,
      /settingsProviderId/,
      "provider selection should use a settings draft state",
    );
    assert.match(
      source,
      /settingsModelId/,
      "model selection should use a settings draft state",
    );
    assert.match(
      source,
      /settingsApiKey/,
      "API key input should use a settings draft state",
    );
    assert.match(
      source,
      /applySettings/,
      "model settings should be applied through an explicit confirm action",
    );
    assert.match(
      source,
      />\s*确认\s*</,
      "settings popover should include a confirm button",
    );
    assert.doesNotMatch(
      source,
      /onChange=\{setModelId\}/,
      "model select should not directly mutate the active model",
    );
    assert.doesNotMatch(
      source,
      /setProviderId\(value\);\s*setModelId\(undefined\);/,
      "provider select should not directly mutate the active provider",
    );
  });
});
