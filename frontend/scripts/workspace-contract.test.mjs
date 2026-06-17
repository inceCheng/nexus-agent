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

  it("supports renaming conversations from the sidebar and title bar", () => {
    assert.match(
      source,
      /EditOutlined/,
      "conversation rename should expose edit affordances",
    );
    assert.match(
      source,
      /renameConversation/,
      "conversation rename should be handled by a dedicated function",
    );
    assert.match(
      source,
      /method:\s*"PATCH"/,
      "conversation rename should call the PATCH conversation API",
    );
    assert.match(
      source,
      /conversation\.updated/,
      "streamed auto-title updates should update the conversation list",
    );
    assert.match(
      source,
      /titleRename/,
      "chat title should support an inline rename state",
    );
  });

  it("renders streamed agent reasoning, tool calls, and skill calls", () => {
    assert.match(
      source,
      /metadataJson/,
      "assistant messages should carry persisted trace metadata",
    );
    assert.match(
      source,
      /traceTimeline/,
      "assistant bubbles should render a dedicated trace timeline",
    );
    assert.match(
      source,
      /reasoning\.delta/,
      "streamed reasoning deltas should update the active trace",
    );
    assert.match(
      source,
      /tool\.started/,
      "streamed tool start events should update the trace timeline",
    );
    assert.match(
      source,
      /skill\.started/,
      "streamed skill start events should update the trace timeline",
    );
    assert.match(
      source,
      /正在思考/,
      "active reasoning should use the expected concise Chinese label",
    );
    assert.match(
      source,
      /工具调用/,
      "tool traces should be visible as tool-call rows",
    );
    assert.match(
      source,
      /Skill 调用/,
      "skill traces should be visible as skill-call rows",
    );
  });

  it("keeps assistant bubble content string-based so typing animation can run", () => {
    assert.match(
      source,
      /content:\s*item\.content,/,
      "Bubble content should stay as the message string for Ant Design X typing",
    );
    assert.doesNotMatch(
      source,
      /content:\s*item\.role === "assistant"\s*\?\s*\(\s*<AssistantMessageContent/s,
      "assistant content should not be replaced with a React node before Bubble typing runs",
    );
    assert.match(
      source,
      /loading:\s*item\.status === "loading"/,
      "streaming messages should not be hidden behind Bubble loading",
    );
    assert.doesNotMatch(
      source,
      /loading:\s*item\.status === "loading"\s*\|\|\s*item\.status === "updating"/,
      "updating messages should keep rendering streamed text and traces",
    );
  });

  it("preserves streamed traces when the saved assistant message arrives", () => {
    assert.match(
      source,
      /mergeSavedAssistantMessage\(item,\s*saved\)/,
      "message.done should merge saved content with the in-flight trace metadata",
    );
    assert.doesNotMatch(
      source,
      /item\.id === assistantMessageIdRef\.current\s*\?\s*saved\s*:\s*item/,
      "message.done should not replace the in-flight assistant message and drop traces",
    );
  });

  it("formats trace previews as readable text instead of raw JSON blocks", () => {
    assert.match(
      source,
      /formatTracePreviewValue\(value\)/,
      "trace preview should normalize legacy JSON-like values before rendering",
    );
    assert.doesNotMatch(
      source,
      /<pre>\{value\}<\/pre>/,
      "trace preview should not render raw serialized JSON strings directly",
    );
    assert.match(
      source,
      /extractReadableTraceText/,
      "trace preview should extract readable text from tool and skill payloads",
    );
  });
});
