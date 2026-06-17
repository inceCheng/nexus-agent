import { describe, expect, it } from "vitest";

import {
  AgentRunnerService,
  type ChatModelFactory,
  normalizeGeneratedTitle,
} from "./agent-runner.service";

describe("AgentRunnerService title generation", () => {
  it("asks the active chat model to generate a concise conversation title", async () => {
    const capturedMessages: unknown[] = [];
    const modelFactory = (() => ({
      invoke: async (messages: unknown[]) => {
        capturedMessages.push(...messages);
        return { content: '"DeepAgents 工作流"' };
      },
    })) as unknown as ChatModelFactory;
    const service = new AgentRunnerService(modelFactory);

    await expect(
      service.generateConversationTitle({
        providerId: "openai",
        modelId: "gpt-5.2",
        apiKey: "sk-test",
        modelInfo: null,
        userContent: "请帮我解释一下 DeepAgents 的工作流",
        assistantContent: "DeepAgents 可以把任务拆成计划、子任务和工具调用。",
      }),
    ).resolves.toBe("DeepAgents 工作流");

    expect(capturedMessages).toHaveLength(2);
    expect(capturedMessages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining("只输出标题"),
    });
    expect(capturedMessages[1]).toMatchObject({
      role: "user",
      content: expect.stringContaining("请帮我解释一下 DeepAgents 的工作流"),
    });
  });

  it("normalizes generated titles into a single short line", () => {
    expect(normalizeGeneratedTitle("标题：**DeepAgents 工作流与工具调用**\n")).toBe(
      "DeepAgents 工作流与工具调用",
    );
    expect(normalizeGeneratedTitle("")).toBeNull();
  });
});
