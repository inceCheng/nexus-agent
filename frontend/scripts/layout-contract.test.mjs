import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(
  resolve(__dirname, "../src/components/nexus-workspace.module.css"),
  "utf8",
);

function ruleBody(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1];
}

function assertRuleContains(selector, declarations) {
  const body = ruleBody(selector);

  for (const declaration of declarations) {
    assert.match(
      body,
      declaration,
      `${selector} should include ${declaration.toString()}`,
    );
  }
}

describe("NexusWorkspace viewport layout contract", () => {
  it("keeps the app shell constrained to the viewport", () => {
    assertRuleContains(".shell", [
      /height:\s*100dvh;/,
      /overflow:\s*hidden;/,
    ]);
  });

  it("keeps the sidebar conversation list internally scrollable", () => {
    assertRuleContains(".sidebar", [
      /height:\s*100%;/,
      /min-height:\s*0;/,
      /overflow:\s*hidden;/,
    ]);
    assertRuleContains(".conversationList", [
      /min-height:\s*0;/,
      /overflow-y:\s*auto;/,
      /scrollbar-width:\s*none;/,
      /-ms-overflow-style:\s*none;/,
    ]);
  });

  it("keeps messages scrollable while the sender remains pinned", () => {
    assertRuleContains(".workspace", [
      /height:\s*100%;/,
      /min-height:\s*0;/,
      /overflow:\s*hidden;/,
    ]);
    assertRuleContains(".messages", [
      /min-height:\s*0;/,
      /overflow:\s*hidden;/,
    ]);
    assertRuleContains(".bubbleList", [
      /height:\s*100%;/,
      /overflow-y:\s*auto;/,
    ]);
    assertRuleContains(".senderBar", [/flex-shrink:\s*0;/]);
    assertRuleContains(".composerShell", [
      /width:\s*min\(760px,\s*100%\);/,
      /margin:\s*0 auto;/,
    ]);
  });
});
